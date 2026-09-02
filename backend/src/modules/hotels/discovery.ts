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
  query: Pick<HotelSearchQuery, 'radiusKm' | 'limit' | 'amenities'>,
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

  const hotels = filterByAmenities(
    dedupeHotels(attempts.flatMap((attempt) => attempt.hotels)),
    query.amenities,
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
  query: Pick<HotelSearchQuery, 'radiusKm' | 'limit'>,
  fetchedAt: string,
  fetchImpl: FetchLike,
): Promise<HotelDiscoveryItem[]> {
  const radiusMeters = Math.round(query.radiusKm * 1000);
  const url = new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set('categories', 'accommodation.hotel,accommodation.guest_house,accommodation.hostel,accommodation.motel');
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

async function fetchOverpassHotels(
  center: SearchCenter,
  query: Pick<HotelSearchQuery, 'radiusKm' | 'limit'>,
  fetchedAt: string,
  fetchImpl: FetchLike,
): Promise<HotelDiscoveryItem[]> {
  const radiusMeters = Math.round(query.radiusKm * 1000);
  const hotelTypes = 'hotel|guest_house|hostel|motel|apartment';
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

export function normalizeGeoapifyHotel(feature: unknown, center: SearchCenter, fetchedAt: string): HotelDiscoveryItem | null {
  const record = asRecord(feature);
  const properties = asRecord(record.properties);
  const geometry = asRecord(record.geometry);
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const longitude = numberOrNull(coordinates[0]);
  const latitude = numberOrNull(coordinates[1]);
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
    phone: stringOrNull(properties.phone) ?? stringOrNull(raw.phone) ?? stringOrNull(raw['contact:phone']),
    website: stringOrNull(properties.website) ?? stringOrNull(raw.website) ?? stringOrNull(raw['contact:website']),
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
  provider: 'GEOAPIFY' | 'OPENSTREETMAP';
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
    amenities: inferAmenities(input.raw),
    phone: input.phone,
    website: input.website,
    starRating: numberOrNull(input.raw.stars),
    wheelchairAccessible: boolFromTag(input.raw.wheelchair),
    source: input.source,
    pricing: {
      available: false,
      message: 'Discovery providers do not prove live room prices. Use /api/v1/hotels/offers after an offers provider is configured.',
    },
    trust: {
      status: 'SOURCE_BACKED',
      confidence: input.confidence,
      warnings: ['Availability and price are not verified by discovery data.'],
    },
  };
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

function filterByAmenities(hotels: HotelDiscoveryItem[], amenities?: string): HotelDiscoveryItem[] {
  const requested = (amenities ?? '')
    .split(',')
    .map((amenity) => normalizeName(amenity))
    .filter(Boolean);

  if (requested.length === 0) return hotels;

  return hotels.filter((hotel) => {
    const available = hotel.amenities.map((amenity) => normalizeName(amenity));
    return requested.every((amenity) => available.includes(amenity));
  });
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
