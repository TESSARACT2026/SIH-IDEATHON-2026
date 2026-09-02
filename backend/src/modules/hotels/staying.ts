import { env } from '../../shared/config/index.js';
import { TTLMemoryCache } from '../../shared/utils/cache.js';
import type { HotelOffer, HotelSourceAttribution, HotelUnavailableState } from './types.js';
import { getHotelCapabilityStatus, hotelUnavailableState } from './provider-status.js';
import type { hotelOffersQuerySchema } from './schemas.js';
import type { z } from 'zod';

type HotelOffersQuery = z.infer<typeof hotelOffersQuerySchema>;
type FetchLike = typeof fetch;

const allowedBookingHosts = [
  'airbnb.com',
  'booking.com',
  'expedia.com',
  'google.com',
  'hotels.com',
  'stayingapi.com',
  'tripadvisor.com',
  'vrbo.com',
];
const stayingOffersCache = new TTLMemoryCache<Awaited<ReturnType<typeof buildSuccessfulOffersResponse>>>(10 * 60 * 1000);

export function buildHotelOffersResponse(meta: unknown, unavailable = hotelUnavailableState('OFFERS')) {
  return {
    data: {
      offers: [],
      unavailable,
      providerStatus: getHotelCapabilityStatus('OFFERS'),
    },
    meta,
  };
}

export async function getHotelOffers(query: HotelOffersQuery, fetchImpl: FetchLike = fetch) {
  if (!env.STAYING_API_KEY.trim()) return buildHotelOffersResponse(query);

  const request = stayingRequestFor(query);
  if (!request) {
    return buildHotelOffersResponse(query, {
      code: 'HOTEL_OFFERS_MAPPING_REQUIRED',
      message: 'Pass a Staying platform/listing id, googleHotelId, or hotel name/location to fetch live offers.',
      action: 'WAIT_FOR_PROVIDER_IMPLEMENTATION',
    });
  }

  const fetchedAt = new Date().toISOString();
  const cacheKey = JSON.stringify({ request, query });
  const cached = stayingOffersCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      data: {
        ...cached.data,
        freshness: { ...cached.data.freshness, cached: true },
      },
    };
  }

  const response = await fetchStaying(request.path, request.params, fetchImpl);
  if (response.status === 202) {
    return buildHotelOffersResponse(query, {
      code: 'HOTEL_OFFERS_ASYNC_PENDING',
      message: 'Staying API accepted the request asynchronously. Retry offers after a short delay.',
      action: 'RETRY_LATER',
    });
  }

  if (!response.ok) {
    return buildHotelOffersResponse(query, {
      code: 'HOTEL_OFFERS_PROVIDER_ERROR',
      message: `Staying API did not return usable offers for this request (${response.status}).`,
      action: response.status === 401 ? 'CONFIGURE_PROVIDER_KEY' : 'RETRY_LATER',
    });
  }

  const payload = await response.json() as Record<string, unknown>;
  const offers = normalizeStayingOffers(payload.data, query, fetchedAt).slice(0, query.limit);
  if (offers.length === 0) {
    return buildHotelOffersResponse(query, hotelUnavailableState('OFFERS'));
  }

  const result = buildSuccessfulOffersResponse(query, request, offers, fetchedAt, warningsFromStayingMeta(payload.meta));
  stayingOffersCache.set(cacheKey, result);
  return result;
}

export function safeBookingLink(rawUrl: string) {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const allowed = url.protocol === 'https:' && allowedBookingHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));

  if (!allowed) {
    return {
      allowed: false,
      reason: 'Only HTTPS booking links from approved hotel providers are allowed.',
      url: null,
    };
  }

  return {
    allowed: true,
    reason: null,
    url: url.toString(),
  };
}

function stayingRequestFor(query: HotelOffersQuery) {
  const decoded = decodeStayingId(query.hotelId);
  const platform = query.platform ?? decoded?.platform;
  const listingId = query.providerHotelId ?? decoded?.listingId;

  if (platform && listingId) {
    return {
      mode: 'PRICE',
      path: '/price',
      params: {
        platform,
        listingId,
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        currency: query.currency,
      },
    };
  }

  if (query.googleHotelId || query.name || query.location) {
    return {
      mode: 'PRICE_COMPARE',
      path: '/price-compare',
      params: {
        ...(query.googleHotelId ? { googleHotelId: query.googleHotelId } : {}),
        ...(query.name ? { name: query.name } : {}),
        ...(query.location ? { location: query.location } : {}),
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        adults: query.adults,
        currency: query.currency,
      },
    };
  }

  return null;
}

function buildSuccessfulOffersResponse(
  query: HotelOffersQuery,
  request: NonNullable<ReturnType<typeof stayingRequestFor>>,
  offers: HotelOffer[],
  fetchedAt: string,
  warnings: unknown[],
) {
  return {
    data: {
      offers,
      providerStatus: getHotelCapabilityStatus('OFFERS'),
      sourceMix: { STAYING: offers.length },
      freshness: { cached: false, fetchedAt, cacheTtlSeconds: 600 },
      warnings,
    },
    meta: {
      ...query,
      providerRequest: {
        provider: 'STAYING',
        path: request.path,
        mode: request.mode,
      },
    },
  };
}

function decodeStayingId(id: string): { platform: HotelOffersQuery['platform']; listingId: string } | null {
  if (!id.startsWith('staying:')) return null;
  const [, platform, ...rest] = id.split(':');
  const listingId = rest.join(':');
  if (!platform || !listingId) return null;
  if (!['airbnb', 'booking', 'vrbo', 'expedia', 'hotels', 'google', 'tripadvisor'].includes(platform)) return null;
  return { platform: platform as HotelOffersQuery['platform'], listingId };
}

async function fetchStaying(path: string, params: Record<string, string | number | undefined>, fetchImpl: FetchLike) {
  const url = new URL(`${env.STAYING_API_BASE_URL.replace(/\/$/, '')}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${env.STAYING_API_KEY}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
}

function normalizeStayingOffers(data: unknown, query: HotelOffersQuery, fetchedAt: string): HotelOffer[] {
  const records = dataRecords(data);
  return records
    .flatMap((record) => {
      const nestedOffers = dataRecords(record.offers ?? record.prices ?? record.results);
      return nestedOffers.length ? nestedOffers.map((offer) => ({ ...offer, parent: record })) : [record];
    })
    .map((record, index) => normalizeStayingOffer(record, query, fetchedAt, index))
    .filter((offer): offer is HotelOffer => Boolean(offer));
}

function normalizeStayingOffer(record: Record<string, unknown>, query: HotelOffersQuery, fetchedAt: string, index: number): HotelOffer | null {
  const parent = asRecord(record.parent);
  const price = asRecord(record.price);
  const fees = asRecord(record.fees ?? record.taxesAndFees);
  const nights = nightsBetween(query.checkIn, query.checkOut);
  const totalAmount =
    numberValue(record.totalPrice) ??
    numberValue(record.totalAmount) ??
    numberValue(record.total) ??
    numberValue(price.total) ??
    numberValue(price.amount) ??
    numberValue(record.price);
  const nightlyAmount =
    numberValue(record.nightlyPrice) ??
    numberValue(record.nightlyAmount) ??
    numberValue(price.nightly) ??
    (totalAmount !== null ? Math.round(totalAmount / nights) : null);

  if (totalAmount === null && nightlyAmount === null) return null;

  const platform = textValue(record.platform) ?? textValue(parent.platform) ?? query.platform ?? null;
  const providerHotelId =
    textValue(record.platformListingId) ??
    textValue(record.listingId) ??
    textValue(record.id) ??
    textValue(parent.platformListingId) ??
    textValue(parent.listingId) ??
    query.providerHotelId ??
    null;
  const bookingUrl = safeProviderUrl(textValue(record.bookingUrl) ?? textValue(record.url) ?? textValue(parent.bookingUrl) ?? textValue(parent.url));

  return {
    id: `staying:${platform ?? 'unknown'}:${providerHotelId ?? index}`,
    provider: 'STAYING',
    platform,
    providerHotelId,
    hotelName: textValue(record.name) ?? textValue(record.hotelName) ?? textValue(parent.name) ?? query.name ?? null,
    roomName: textValue(record.roomName) ?? textValue(record.roomType) ?? null,
    currency: textValue(record.currency) ?? textValue(price.currency) ?? query.currency,
    nightlyAmount,
    totalAmount,
    taxesAndFeesAmount: numberValue(record.taxesAndFees) ?? numberValue(record.fees) ?? numberValue(fees.total),
    nights,
    rooms: query.rooms,
    adults: query.adults,
    bookingUrl,
    refundable: booleanValue(record.refundable),
    source: stayingSource(fetchedAt),
    confidence: totalAmount !== null ? 'LIVE_PROVIDER' : 'PARTIAL_PROVIDER',
  };
}

function dataRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.map(asRecord).filter((record) => Object.keys(record).length > 0);
  const record = asRecord(data);
  for (const key of ['offers', 'prices', 'results', 'properties']) {
    const nested = record[key];
    if (Array.isArray(nested)) return nested.map(asRecord).filter((item) => Object.keys(item).length > 0);
  }
  return Object.keys(record).length > 0 ? [record] : [];
}

function warningsFromStayingMeta(meta: unknown) {
  const warnings = asRecord(meta).warnings;
  return Array.isArray(warnings) ? warnings : [];
}

function safeProviderUrl(value: string | null) {
  if (!value) return null;
  try {
    const link = safeBookingLink(value);
    return link.allowed ? link.url : null;
  } catch {
    return null;
  }
}

function stayingSource(fetchedAt: string): HotelSourceAttribution {
  return {
    provider: 'STAYING',
    name: 'Staying API',
    attribution: 'Live accommodation offers from Staying API.',
    url: 'https://stayingapi.com/docs',
    fetchedAt,
  };
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(1, Math.ceil((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', 'yes', '1', 'refundable'].includes(normalized)) return true;
    if (['false', 'no', '0', 'non_refundable'].includes(normalized)) return false;
  }
  return null;
}
