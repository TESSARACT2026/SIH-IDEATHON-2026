import { env } from '../../shared/config/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { TTLMemoryCache } from '../../shared/utils/cache.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';
import type { HotelDiscoveryItem, HotelSourceAttribution, HotelUnavailableState } from './types.js';
import { getHotelCapabilityStatus, hotelUnavailableState } from './provider-status.js';
import type { hotelSearchQuerySchema } from './schemas.js';
import type { z } from 'zod';

type HotelSearchQuery = z.infer<typeof hotelSearchQuerySchema>;

type SearchCenter = {
  latitude: number;
  longitude: number;
  label: string;
  destinationId?: string;
};

type FetchLike = typeof fetch;

interface DiscoveryAttempt {
  provider: 'GEOAPIFY' | 'OPENSTREETMAP';
  hotels: HotelDiscoveryItem[];
  warning?: string;
}

const hotelDiscoveryCache = new TTLMemoryCache<Awaited<ReturnType<typeof buildHotelDiscoveryPayload>>>(15 * 60 * 1000);

export async function searchHotels(query: HotelSearchQuery) {
  const center = await resolveSearchCenter(query);
  const cacheKey = [
    center.latitude.toFixed(4),
    center.longitude.toFixed(4),
    query.radiusKm,
    query.limit,
    query.amenities?.toLowerCase() ?? '',
    query.type ?? '',
    query.wheelchairAccessible ?? '',
    query.wifi ?? '',
    query.parking ?? '',
    query.sort ?? '',
    Boolean(env.GEOAPIFY_API_KEY.trim()),
  ].join(':');

  const cached = hotelDiscoveryCache.get(cacheKey);
  if (cached) {
    return { data: { ...cached, freshness: { ...cached.freshness, cached: true } }, meta: { ...query, center } };
  }

  const payload = await buildHotelDiscoveryPayload(center, query);
  hotelDiscoveryCache.set(cacheKey, payload);

  return { data: payload, meta: { ...query, center } };
}

export async function getHotelDetails(id: string, fetchImpl: FetchLike = fetch) {
  const fetchedAt = new Date().toISOString();
  const providerId = decodeHotelProviderId(id);
  const hotel =
    providerId.provider === 'GEOAPIFY'
      ? await fetchGeoapifyHotelDetails(providerId.id, fetchedAt, fetchImpl)
      : await fetchOverpassHotelDetails(providerId.osmType, providerId.osmId, fetchedAt, fetchImpl);

  return {
    data: {
      hotel,
      providerStatus: getHotelCapabilityStatus('DETAILS'),
      freshness: {
        cached: false,
        fetchedAt,
        cacheTtlSeconds: 0,
      },
    },
    meta: { id },
  };
}

async function resolveSearchCenter(query: HotelSearchQuery): Promise<SearchCenter> {
  if (query.lat !== undefined && query.lon !== undefined) {
    return {
      latitude: query.lat,
      longitude: query.lon,
      label: 'custom coordinates',
    };
  }

  const destinationId = resolveDestinationId(query.destinationId ?? '');
  const destination = await prisma.destination.findUnique({ where: { id: destinationId } });
  if (!destination) {
    throw new AppError('Destination not found', 404, 'NOT_FOUND');
  }

  return {
    latitude: destination.latitude,
    longitude: destination.longitude,
    label: [destination.name, destination.region, destination.country].filter(Boolean).join(', '),
    destinationId,
  };
}

export async function buildHotelDiscoveryPayload(
  center: SearchCenter,
  query: Pick<HotelSearchQuery, 'radiusKm' | 'limit' | 'amenities' | 'type' | 'wheelchairAccessible' | 'wifi' | 'parking' | 'sort'>,
  fetchImpl: FetchLike = fetch,
) {
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];
  const attempts: DiscoveryAttempt[] = [];

  if (env.GEOAPIFY_API_KEY.trim()) {
    try {
      const hotels = await fetchGeoapifyHotels(center, query, fetchedAt, fetchImpl);
      attempts.push({ provider: 'GEOAPIFY', hotels });
    } catch {
      warnings.push('Geoapify hotel discovery failed; OpenStreetMap/Overpass fallback was attempted.');
    }
  } else {
    warnings.push('GEOAPIFY_API_KEY is missing; OpenStreetMap/Overpass fallback was used for discovery.');
  }

  const geoapifyHotels = attempts.find((attempt) => attempt.provider === 'GEOAPIFY')?.hotels ?? [];
  if (geoapifyHotels.length === 0) {
    try {
      const hotels = await fetchOverpassHotels(center, query, fetchedAt, fetchImpl);
      attempts.push({ provider: 'OPENSTREETMAP', hotels });
    } catch {
      warnings.push('OpenStreetMap/Overpass hotel discovery failed.');
    }
  }

  const hotels = sortHotels(
    filterHotels(dedupeHotels(attempts.flatMap((attempt) => attempt.hotels)), query),
    query.sort,
  ).slice(0, query.limit);
  const unavailable: HotelUnavailableState | undefined = hotels.length === 0 ? hotelUnavailableState('DISCOVERY') : undefined;

  return {
    hotels,
    ...(unavailable ? { unavailable } : {}),
    providerStatus: getHotelCapabilityStatus('DISCOVERY'),
    sourceMix: sourceMix(hotels),
    attribution: uniqueAttributions(hotels),
    warnings,
    freshness: {
      cached: false,
      fetchedAt,
      cacheTtlSeconds: 900,
    },
  };
}

async function fetchGeoapifyHotels(
  center: SearchCenter,
  query: Pick<HotelSearchQuery, 'radiusKm' | 'limit' | 'type'>,
  fetchedAt: string,
  fetchImpl: FetchLike,
): Promise<HotelDiscoveryItem[]> {
  const radiusMeters = Math.round(query.radiusKm * 1000);
  const categories = query.type ? [`accommodation.${query.type}`] : ['accommodation.hotel', 'accommodation.guest_house', 'accommodation.hostel', 'accommodation.motel'];
  const url = new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set('categories', categories.join(','));
  url.searchParams.set('filter', `circle:${center.longitude},${center.latitude},${radiusMeters}`);
  url.searchParams.set('bias', `proximity:${center.longitude},${center.latitude}`);
  url.searchParams.set('limit', String(query.limit));
  url.searchParams.set('apiKey', env.GEOAPIFY_API_KEY);

  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) {
    throw new Error(`Geoapify hotel discovery failed with ${response.status}`);
  }

  const data = await response.json() as { features?: unknown[] };
  return (data.features ?? [])
    .map((feature) => normalizeGeoapifyHotel(feature, center, fetchedAt))
    .filter((hotel): hotel is HotelDiscoveryItem => Boolean(hotel));
}

async function fetchGeoapifyHotelDetails(
  placeId: string,
  fetchedAt: string,
  fetchImpl: FetchLike,
): Promise<HotelDiscoveryItem> {
  if (!env.GEOAPIFY_API_KEY.trim()) {
    throw new AppError('Geoapify API key is required for this hotel detail lookup.', 503, 'HOTEL_DETAILS_NOT_CONFIGURED');
  }

  const url = new URL('https://api.geoapify.com/v2/place-details');
  url.searchParams.set('id', placeId);
  url.searchParams.set('features', 'details');
  url.searchParams.set('apiKey', env.GEOAPIFY_API_KEY);

  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) {
    throw new AppError('Hotel details provider failed.', 502, 'HOTEL_DETAILS_PROVIDER_ERROR');
  }

  const data = await response.json() as { features?: unknown[] };
  const detailsFeature = (data.features ?? []).find((feature) => {
    const properties = asRecord(asRecord(feature).properties);
    return properties.feature_type === 'details';
  }) ?? data.features?.[0];
  const hotel = normalizeGeoapifyHotel(detailsFeature, { latitude: 0, longitude: 0, label: 'details lookup' }, fetchedAt);
  if (!hotel) {
    throw new AppError('Hotel details not found.', 404, 'HOTEL_DETAILS_NOT_FOUND');
  }

  return {
    ...hotel,
    distanceKm: 0,
  };
}

async function fetchOverpassHotels(
  center: SearchCenter,
  query: Pick<HotelSearchQuery, 'radiusKm' | 'limit' | 'type'>,
  fetchedAt: string,
  fetchImpl: FetchLike,
): Promise<HotelDiscoveryItem[]> {
  const radiusMeters = Math.round(query.radiusKm * 1000);
  const hotelTypes = query.type ?? 'hotel|guest_house|hostel|motel|apartment';
  const around = `(around:${radiusMeters},${center.latitude},${center.longitude})`;
  const overpassQuery = `[out:json][timeout:8];(node["tourism"~"^(${hotelTypes})$"]${around};way["tourism"~"^(${hotelTypes})$"]${around};relation["tourism"~"^(${hotelTypes})$"]${around};);out center ${query.limit};`;

  const response = await fetchImpl('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MargDarshak/1.0 hotel-discovery backend',
    },
    body: new URLSearchParams({ data: overpassQuery }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Overpass hotel discovery failed with ${response.status}`);
  }

  const data = await response.json() as { elements?: unknown[] };
  return (data.elements ?? [])
    .map((element) => normalizeOverpassHotel(element, center, fetchedAt))
    .filter((hotel): hotel is HotelDiscoveryItem => Boolean(hotel));
}

async function fetchOverpassHotelDetails(
  osmType: 'node' | 'way' | 'relation',
  osmId: string,
  fetchedAt: string,
  fetchImpl: FetchLike,
): Promise<HotelDiscoveryItem> {
  const overpassQuery = `[out:json][timeout:8];${osmType}(${osmId});out center 1;`;
  const response = await fetchImpl('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MargDarshak/1.0 hotel-details backend',
    },
    body: new URLSearchParams({ data: overpassQuery }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new AppError('Hotel details provider failed.', 502, 'HOTEL_DETAILS_PROVIDER_ERROR');
  }

  const data = await response.json() as { elements?: unknown[] };
  const hotel = normalizeOverpassHotel(data.elements?.[0], { latitude: 0, longitude: 0, label: 'details lookup' }, fetchedAt);
  if (!hotel) {
    throw new AppError('Hotel details not found.', 404, 'HOTEL_DETAILS_NOT_FOUND');
  }

  return {
    ...hotel,
    distanceKm: 0,
  };
}

type DecodedHotelProviderId =
  | { provider: 'GEOAPIFY'; id: string }
  | { provider: 'OPENSTREETMAP'; osmType: 'node' | 'way' | 'relation'; osmId: string };

export function decodeHotelProviderId(id: string): DecodedHotelProviderId {
  if (id.startsWith('geoapify:')) {
    const placeId = id.slice('geoapify:'.length);
    if (placeId) return { provider: 'GEOAPIFY', id: placeId };
  }

  if (id.startsWith('osm:')) {
    const [osmType, osmId] = id.slice('osm:'.length).split('/');
    if (
      (osmType === 'node' || osmType === 'way' || osmType === 'relation') &&
      /^\d+$/.test(osmId ?? '')
    ) {
      return { provider: 'OPENSTREETMAP', osmType, osmId };
    }
  }

  throw new AppError('Unsupported hotel id. Use a provider-backed id returned by hotel search.', 400, 'INVALID_HOTEL_ID');
}

export function buildHotelDetailsUnavailableResponse(id: string) {
  const unavailable = hotelUnavailableState('DETAILS');

  return {
    error: {
      code: unavailable.code,
      message: unavailable.message,
    },
    providerStatus: getHotelCapabilityStatus('DETAILS'),
    meta: { id },
  };
}

export function normalizeGeoapifyHotel(feature: unknown, center: SearchCenter, fetchedAt: string): HotelDiscoveryItem | null {
  const record = asRecord(feature);
  const properties = asRecord(record.properties);
  const geometry = asRecord(record.geometry);
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const longitude = numberOrNull(coordinates[0]) ?? numberOrNull(properties.lon);
  const latitude = numberOrNull(coordinates[1]) ?? numberOrNull(properties.lat);
  const name = stringOrNull(properties.name);

  if (!name || latitude === null || longitude === null) return null;

  const raw = asRecord(asRecord(properties.datasource).raw);
  const providerHotelId = stringOrNull(properties.place_id) ?? stringOrNull(properties.datasource_id) ?? `geoapify:${name}:${latitude}:${longitude}`;
  const categories = stringArray(properties.categories);
  const source = hotelSource(
    'GEOAPIFY',
    'Geoapify Places',
    'Hotel discovery from Geoapify Places API.',
    fetchedAt,
    'https://www.geoapify.com/places-api/',
  );

  return baseHotel({
    id: `geoapify:${providerHotelId}`,
  provider: 'GEOAPIFY',
    providerHotelId,
    name,
    latitude,
    longitude,
    center,
    address: stringOrNull(properties.formatted) ?? stringOrNull(properties.address_line2),
    categories,
    raw,
    phone: stringOrNull(asRecord(properties.contact).phone) ?? stringOrNull(properties.phone) ?? stringOrNull(raw.phone) ?? stringOrNull(raw['contact:phone']),
    website: stringOrNull(asRecord(properties.contact).website) ?? stringOrNull(properties.website) ?? stringOrNull(raw.website) ?? stringOrNull(raw['contact:website']),
    source,
    confidence: 0.82,
  });
}

export function normalizeOverpassHotel(element: unknown, center: SearchCenter, fetchedAt: string): HotelDiscoveryItem | null {
  const record = asRecord(element);
  const tags = asRecord(record.tags);
  const latitude = numberOrNull(record.lat) ?? numberOrNull(asRecord(record.center).lat);
  const longitude = numberOrNull(record.lon) ?? numberOrNull(asRecord(record.center).lon);
  const name = stringOrNull(tags.name);
  const id = `${String(record.type ?? 'element')}/${String(record.id ?? '')}`;

  if (!name || latitude === null || longitude === null || id.endsWith('/')) return null;

  const tourism = stringOrNull(tags.tourism) ?? 'hotel';
  const categories = [`accommodation.${tourism.replace(/_/g, '-')}`];
  const source = hotelSource(
    'OPENSTREETMAP',
    'OpenStreetMap via Overpass',
    '© OpenStreetMap contributors',
    fetchedAt,
    'https://www.openstreetmap.org/copyright',
  );

  return baseHotel({
    id: `osm:${id}`,
    provider: 'OPENSTREETMAP',
    providerHotelId: id,
    name,
    latitude,
    longitude,
    center,
    address: formatOsmAddress(tags),
    categories,
    raw: tags,
    phone: stringOrNull(tags.phone) ?? stringOrNull(tags['contact:phone']),
    website: stringOrNull(tags.website) ?? stringOrNull(tags['contact:website']),
    source,
    confidence: 0.74,
  });
}

function baseHotel(input: {
  id: string;
  provider: 'GEOAPIFY' | 'OPENSTREETMAP' | 'STAYING';
  providerHotelId: string;
  name: string;
  latitude: number;
  longitude: number;
  center: SearchCenter;
  address: string | null;
  categories: string[];
  raw: Record<string, unknown>;
  phone: string | null;
  website: string | null;
  source: HotelSourceAttribution;
  confidence: number;
}): HotelDiscoveryItem {
  const amenities = inferAmenities(input.raw);
  const starRating = numberOrNull(input.raw.stars) ?? numberOrNull(input.raw.star_rating);
  const wheelchairAccessible = boolFromTag(input.raw.wheelchair);
  const trustSummary = buildHotelTrustSummary({
    provider: input.provider,
    baseConfidence: input.confidence,
    fetchedAt: input.source.fetchedAt,
    address: input.address,
    categories: input.categories,
    amenities,
    phone: input.phone,
    website: input.website,
    starRating,
    wheelchairAccessible,
  });

  return {
    id: input.id,
    provider: input.provider,
    providerHotelId: input.providerHotelId,
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    distanceKm: round(distanceKm(input.center.latitude, input.center.longitude, input.latitude, input.longitude), 2),
    address: input.address,
    categories: input.categories,
    amenities,
    phone: input.phone,
    website: input.website,
    starRating,
    wheelchairAccessible,
    source: input.source,
    pricing: {
      available: false,
      message: 'Discovery providers do not prove live room prices. Use /api/v1/hotels/offers after an offers provider is configured.',
    },
    trust: {
      status: 'SOURCE_BACKED',
      confidence: trustSummary.score,
      warnings: hotelTrustWarnings(trustSummary),
      summary: trustSummary,
    },
  };
}

function buildHotelTrustSummary(input: {
  provider: 'GEOAPIFY' | 'OPENSTREETMAP' | 'STAYING';
  baseConfidence: number;
  fetchedAt: string;
  address: string | null;
  categories: string[];
  amenities: string[];
  phone: string | null;
  website: string | null;
  starRating: number | null;
  wheelchairAccessible: boolean | null;
}): HotelDiscoveryItem['trust']['summary'] {
  const fields = [
    ['address', Boolean(input.address)],
    ['categories', input.categories.length > 0],
    ['amenities', input.amenities.length > 0],
    ['phone', Boolean(input.phone)],
    ['website', Boolean(input.website)],
    ['starRating', input.starRating !== null],
    ['wheelchairAccessible', input.wheelchairAccessible !== null],
  ] as const;
  const presentCount = fields.filter(([, present]) => present).length;
  const fieldCompleteness = round(presentCount / fields.length, 2);
  const freshness = hotelDataFreshness(input.fetchedAt);
  const score = round((input.baseConfidence * 0.55) + (fieldCompleteness * 0.3) + (freshness.score * 0.15), 2);

  return {
    label: score >= 0.8 ? 'HIGH' : score >= 0.65 ? 'MEDIUM' : 'LOW',
    score,
    sourceTier: input.provider === 'OPENSTREETMAP' ? 'OPENSTREETMAP_COMMUNITY' : 'PROVIDER_PLACE_DATA',
    fieldCompleteness,
    freshness,
    evidenceCount: presentCount + 1,
    missingFields: fields.filter(([, present]) => !present).map(([field]) => field),
  };
}

function hotelDataFreshness(fetchedAt: string): HotelDiscoveryItem['trust']['summary']['freshness'] {
  const timestamp = Date.parse(fetchedAt);
  if (!Number.isFinite(timestamp)) {
    return { status: 'UNKNOWN', score: 0.4, fetchedAt };
  }

  const ageHours = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  if (ageHours <= 24) return { status: 'FRESH', score: 1, fetchedAt };
  if (ageHours <= 168) return { status: 'RECENT', score: 0.85, fetchedAt };
  return { status: 'STALE', score: 0.55, fetchedAt };
}

function hotelTrustWarnings(summary: HotelDiscoveryItem['trust']['summary']): string[] {
  const warnings = ['Availability and price are not verified by discovery data.'];
  if (summary.fieldCompleteness < 0.5) warnings.push('Hotel profile has limited source fields.');
  if (summary.freshness.status === 'STALE' || summary.freshness.status === 'UNKNOWN') warnings.push('Hotel source data freshness is uncertain.');
  return warnings;
}

export function dedupeHotels(hotels: HotelDiscoveryItem[]): HotelDiscoveryItem[] {
  const seen = new Set<string>();
  const deduped: HotelDiscoveryItem[] = [];

  for (const hotel of hotels.sort((a, b) => a.distanceKm - b.distanceKm)) {
    const key = `${normalizeName(hotel.name)}:${Math.round(hotel.latitude * 1000)}:${Math.round(hotel.longitude * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(hotel);
  }

  return deduped;
}

function filterHotels(
  hotels: HotelDiscoveryItem[],
  query: Pick<HotelSearchQuery, 'amenities' | 'type' | 'wheelchairAccessible' | 'wifi' | 'parking'>,
): HotelDiscoveryItem[] {
  const requestedAmenities = (query.amenities ?? '')
    .split(',')
    .map((amenity) => normalizeName(amenity))
    .filter(Boolean);

  const requested = [
    ...requestedAmenities,
    ...(query.wifi ? ['wifi'] : []),
    ...(query.parking ? ['parking'] : []),
  ];
  const requestedType = query.type ? normalizeName(query.type) : null;

  return hotels.filter((hotel) => {
    const available = hotel.amenities.map((amenity) => normalizeName(amenity));
    if (requestedType && !hotel.categories.some((category) => normalizeName(category).includes(requestedType))) return false;
    if (query.wheelchairAccessible === true && hotel.wheelchairAccessible !== true) return false;
    return requested.every((amenity) => available.includes(amenity));
  });
}

function sortHotels(hotels: HotelDiscoveryItem[], sort: HotelSearchQuery['sort']): HotelDiscoveryItem[] {
  return [...hotels].sort((a, b) => {
    if (sort === 'TRUST') return b.trust.confidence - a.trust.confidence || a.distanceKm - b.distanceKm;
    if (sort === 'RECOMMENDED') return hotelRecommendationScore(b) - hotelRecommendationScore(a);
    return a.distanceKm - b.distanceKm;
  });
}

function hotelRecommendationScore(hotel: HotelDiscoveryItem): number {
  return hotel.trust.confidence - Math.min(hotel.distanceKm, 20) / 100;
}

export function rankHotelsForTrip(
  hotels: HotelDiscoveryItem[],
  stops: Array<{ latitude: number | null; longitude: number | null; name?: string | null }>,
  options: { accessibilityWheelchair?: boolean | null; budgetBand?: string | null } = {},
): HotelDiscoveryItem[] {
  const validStops = stops.filter((stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number');
  return hotels
    .map((hotel) => {
      const distances = validStops.map((stop) => distanceKm(hotel.latitude, hotel.longitude, stop.latitude!, stop.longitude!));
      const nearestStopDistanceKm = distances.length ? Math.min(...distances) : null;
      const averageDistanceKm = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null;
      const distanceScore = averageDistanceKm === null ? 0.6 : Math.max(0, 1 - Math.min(averageDistanceKm, 20) / 20);
      const accessibilityScore = options.accessibilityWheelchair ? (hotel.wheelchairAccessible === true ? 1 : 0.2) : 0.8;
      const trustScore = hotel.trust.confidence;
      const score = round((distanceScore * 0.45) + (trustScore * 0.4) + (accessibilityScore * 0.15), 2);

      return {
        ...hotel,
        tripFit: {
          score,
          averageDistanceKm: averageDistanceKm === null ? null : round(averageDistanceKm, 2),
          nearestStopDistanceKm: nearestStopDistanceKm === null ? null : round(nearestStopDistanceKm, 2),
          reasons: [
            ...(averageDistanceKm !== null ? [`Average ${round(averageDistanceKm, 1)} km from planned stops`] : []),
            ...(hotel.wheelchairAccessible === true ? ['Wheelchair access source-backed'] : []),
            `${hotel.trust.summary.label.toLowerCase()} hotel data trust`,
            ...(options.budgetBand ? [`Budget context: ${options.budgetBand}`] : []),
          ],
        },
      };
    })
    .sort((a, b) => (b.tripFit?.score ?? 0) - (a.tripFit?.score ?? 0));
}

function sourceMix(hotels: HotelDiscoveryItem[]) {
  return hotels.reduce<Record<string, number>>((counts, hotel) => {
    counts[hotel.provider] = (counts[hotel.provider] ?? 0) + 1;
    return counts;
  }, {});
}

function uniqueAttributions(hotels: HotelDiscoveryItem[]): HotelSourceAttribution[] {
  const byProvider = new Map<string, HotelSourceAttribution>();
  for (const hotel of hotels) {
    byProvider.set(hotel.source.provider, hotel.source);
  }
  return [...byProvider.values()];
}

function hotelSource(
  provider: 'GEOAPIFY' | 'OPENSTREETMAP',
  name: string,
  attribution: string,
  fetchedAt: string,
  url: string,
): HotelSourceAttribution {
  return { provider, name, attribution, fetchedAt, url };
}

function inferAmenities(raw: Record<string, unknown>): string[] {
  const amenities = new Set<string>();
  const internet = normalizeName(String(raw.internet_access ?? raw.wifi ?? raw['internet_access:fee'] ?? ''));
  const wheelchair = boolFromTag(raw.wheelchair);

  if (['yes', 'wlan', 'wifi', 'free'].includes(internet)) amenities.add('wifi');
  if (wheelchair === true) amenities.add('wheelchair');
  if (isTruthyTag(raw.parking)) amenities.add('parking');
  if (isTruthyTag(raw.breakfast)) amenities.add('breakfast');
  if (isTruthyTag(raw.restaurant)) amenities.add('restaurant');
  if (isTruthyTag(raw.swimming_pool)) amenities.add('pool');

  return [...amenities].sort();
}

function formatOsmAddress(tags: Record<string, unknown>): string | null {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].map(stringOrNull).filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function boolFromTag(value: unknown): boolean | null {
  const normalized = normalizeName(String(value ?? ''));
  if (['yes', 'true', '1', 'designated', 'limited'].includes(normalized)) return true;
  if (['no', 'false', '0'].includes(normalized)) return false;
  return null;
}

function isTruthyTag(value: unknown): boolean {
  return boolFromTag(value) === true;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
