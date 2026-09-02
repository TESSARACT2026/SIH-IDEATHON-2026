import { env } from '../../shared/config/index.js';
import { TTLMemoryCache } from '../../shared/utils/cache.js';
import type { HotelOffer, HotelSourceAttribution, HotelUnavailableState } from './types.js';
import { getHotelCapabilityStatus, hotelUnavailableState } from './provider-status.js';
import type { hotelOffersQuerySchema } from './schemas.js';
import type { z } from 'zod';

type HotelOffersQuery = z.infer<typeof hotelOffersQuerySchema>;
type FetchLike = typeof fetch;
type StayingRequest = NonNullable<ReturnType<typeof stayingRequestFor>>;

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
const stayingJobPollAttempts = 4;
const stayingJobPollDelayMs = 1_000;
const stayingJobPollMaxDelayMs = 2_000;
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
  let payload: Record<string, unknown>;

  if (response.status === 202) {
    const job = await pollStayingJob(response, fetchImpl);
    if (job.status !== 'COMPLETED') {
      return buildHotelOffersResponse(query, {
        code: job.status === 'FAILED' ? 'HOTEL_OFFERS_PROVIDER_ERROR' : 'HOTEL_OFFERS_ASYNC_PENDING',
        message: job.message ?? 'Staying API is still preparing live offers. Retry offers after a short delay.',
        action: 'RETRY_LATER',
      });
    }
    payload = job.payload;
  } else if (!response.ok) {
    return buildHotelOffersResponse(query, {
      code: 'HOTEL_OFFERS_PROVIDER_ERROR',
      message: `Staying API did not return usable offers for this request (${response.status}).`,
      action: response.status === 401 ? 'CONFIGURE_PROVIDER_KEY' : 'RETRY_LATER',
    });
  } else {
    payload = await response.json() as Record<string, unknown>;
  }

  const warnings = warningsFromStayingMeta(payload.meta);
  const sandboxSample = hasWarningCode(warnings, 'sandbox_data');
  const offers = normalizeStayingOffers(payload.data, query, fetchedAt, sandboxSample).slice(0, query.limit);
  if (offers.length === 0) {
    return buildHotelOffersResponse(query, hotelUnavailableState('OFFERS'));
  }

  const result = buildSuccessfulOffersResponse(query, request, offers, fetchedAt, warnings);
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
  request: StayingRequest,
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
  const url = stayingUrl(path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return fetchStayingUrl(url, fetchImpl);
}

async function fetchStayingUrl(url: URL, fetchImpl: FetchLike) {
  return fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${env.STAYING_API_KEY}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
}

async function pollStayingJob(response: Response, fetchImpl: FetchLike): Promise<
  | { status: 'COMPLETED'; payload: Record<string, unknown> }
  | { status: 'PENDING'; message?: string }
  | { status: 'FAILED'; message?: string }
> {
  const acceptedPayload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const jobUrl = stayingJobUrl(acceptedPayload);
  if (!jobUrl) return { status: 'PENDING' };

  let delayMs = retryAfterMs(response, stayingJobPollDelayMs);
  for (let attempt = 0; attempt < stayingJobPollAttempts; attempt += 1) {
    if (delayMs > 0) await sleep(delayMs);

    const pollResponse = await fetchStayingUrl(jobUrl, fetchImpl);
    if (pollResponse.status === 202) {
      delayMs = retryAfterMs(pollResponse, stayingJobPollDelayMs);
      continue;
    }

    const jobPayload = await pollResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!pollResponse.ok) {
      return { status: 'FAILED', message: `Staying API job poll failed (${pollResponse.status}).` };
    }

    const status = textValue(asRecord(jobPayload.data).status)?.toLowerCase();
    if (status === 'completed') {
      const payload = completedJobPayload(jobPayload);
      return payload ? { status: 'COMPLETED', payload } : { status: 'FAILED', message: 'Staying API job completed without offer data.' };
    }
    if (status === 'failed') return { status: 'FAILED', message: jobFailureMessage(jobPayload) };
    if (!status && Object.prototype.hasOwnProperty.call(jobPayload, 'data')) return { status: 'COMPLETED', payload: jobPayload };

    delayMs = retryAfterMs(pollResponse, stayingJobPollDelayMs);
  }

  return { status: 'PENDING' };
}

function stayingJobUrl(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  const jobId = textValue(data.jobId) ?? textValue(data.id) ?? textValue(payload.jobId) ?? textValue(payload.id);
  if (jobId) return stayingUrl(`/jobs/${encodeURIComponent(jobId)}`);

  const pollUrl = textValue(data.pollUrl) ?? textValue(payload.pollUrl);
  if (!pollUrl) return null;

  const base = new URL(env.STAYING_API_BASE_URL);
  const url = new URL(pollUrl, base);
  return url.origin === base.origin ? url : null;
}

function stayingUrl(path: string) {
  const base = new URL(env.STAYING_API_BASE_URL.replace(/\/$/, ''));
  if (/^https?:\/\//i.test(path)) return new URL(path);

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === base.pathname || normalizedPath.startsWith(`${base.pathname}/`)) {
    return new URL(`${base.origin}${normalizedPath}`);
  }
  return new URL(`${base.href}${normalizedPath}`);
}

function completedJobPayload(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  const result = data.result;
  if (result === undefined) return null;

  const resultRecord = asRecord(result);
  if (Object.prototype.hasOwnProperty.call(resultRecord, 'data')) return resultRecord;
  return { data: result, meta: data.meta ?? payload.meta };
}

function jobFailureMessage(payload: Record<string, unknown>) {
  const error = asRecord(asRecord(payload.data).error);
  return textValue(error.message) ?? 'Staying API async job failed for this request.';
}

function retryAfterMs(response: Response, fallbackMs: number) {
  const seconds = Number(response.headers.get('Retry-After'));
  const delayMs = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : fallbackMs;
  return Math.min(delayMs, stayingJobPollMaxDelayMs);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStayingOffers(data: unknown, query: HotelOffersQuery, fetchedAt: string, sandboxSample: boolean): HotelOffer[] {
  const records = dataRecords(data);
  return records
    .flatMap((record) => {
      const nestedOffers = dataRecords(record.offers ?? record.prices ?? record.results);
      return nestedOffers.length ? nestedOffers.map((offer) => ({ ...offer, parent: record })) : [record];
    })
    .map((record, index) => normalizeStayingOffer(record, query, fetchedAt, index, sandboxSample))
    .filter((offer): offer is HotelOffer => Boolean(offer));
}

function normalizeStayingOffer(record: Record<string, unknown>, query: HotelOffersQuery, fetchedAt: string, index: number, sandboxSample: boolean): HotelOffer | null {
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
    confidence: sandboxSample ? 'SANDBOX_SAMPLE' : totalAmount !== null ? 'LIVE_PROVIDER' : 'PARTIAL_PROVIDER',
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

function hasWarningCode(warnings: unknown[], code: string) {
  return warnings.some((warning) => asRecord(warning).code === code);
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
