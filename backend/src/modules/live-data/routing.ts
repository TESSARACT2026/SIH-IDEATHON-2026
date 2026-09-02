import { env } from '../../shared/config/index.js';
import { cache } from './cache.js';

const ROUTING_CACHE_TTL = 86400; // 24 hours (routes rarely change)

export interface RoutingData {
  distance_meters: number;
  duration_seconds: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  source: 'OPENROUTESERVICE' | 'FALLBACK_STRAIGHT_LINE';
}

export async function getRoute(
  startLat: number, 
  startLon: number, 
  endLat: number, 
  endLon: number, 
  profile: 'driving-car' | 'foot-walking' = 'driving-car',
  fetchImpl: typeof fetch = fetch,
): Promise<RoutingData> {
  const cacheKey = `route:${profile}:${startLat.toFixed(4)},${startLon.toFixed(4)}->${endLat.toFixed(4)},${endLon.toFixed(4)}`;
  
  const cached = cache.get<RoutingData>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${env.ROUTING_API_KEY}&start=${startLon},${startLat}&end=${endLon},${endLat}`;
    const response = await fetchImpl(url);
    
    if (!response.ok) {
      throw new Error(`OpenRouteService returned ${response.status}`);
    }

    const data = (await response.json()) as {
      features?: Array<{
        geometry?: { type?: string; coordinates?: unknown[] };
        properties?: { segments?: Array<{ distance: number; duration: number }> };
      }>;
    };
    
    // ORS returns features[0].properties.segments[0]
    const segment = data.features?.[0]?.properties?.segments?.[0];
    
    if (!segment) {
      throw new Error('No route found');
    }

    const routingData: RoutingData = {
      distance_meters: segment.distance,
      duration_seconds: segment.duration,
      geometry: parseLineString(data.features?.[0]?.geometry) ?? straightLineGeometry(startLat, startLon, endLat, endLon),
      source: 'OPENROUTESERVICE',
    };

    cache.set(cacheKey, routingData, ROUTING_CACHE_TTL);
    return routingData;
  } catch (error) {
    if (env.NODE_ENV !== 'test') console.error('Routing API failed:', error);
    const routingData = straightLineRoute(startLat, startLon, endLat, endLon, profile);
    cache.set(cacheKey, routingData, ROUTING_CACHE_TTL);
    return routingData;
  }
}

export function straightLineRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  profile: 'driving-car' | 'foot-walking' = 'driving-car',
): RoutingData {
  const distanceMeters = Math.round(distanceKm(startLat, startLon, endLat, endLon) * 1000);
  const speedMetersPerSecond = profile === 'foot-walking' ? 1.2 : 9.7;
  return {
    distance_meters: distanceMeters,
    duration_seconds: Math.max(60, Math.round(distanceMeters / speedMetersPerSecond)),
    geometry: straightLineGeometry(startLat, startLon, endLat, endLon),
    source: 'FALLBACK_STRAIGHT_LINE',
  };
}

function parseLineString(geometry: { type?: string; coordinates?: unknown[] } | undefined): RoutingData['geometry'] | null {
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  const coordinates = geometry.coordinates
    .map((point) => Array.isArray(point) ? [Number(point[0]), Number(point[1])] as [number, number] : null)
    .filter((point): point is [number, number] => point !== null && point.every(Number.isFinite));
  return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
}

function straightLineGeometry(startLat: number, startLon: number, endLat: number, endLon: number): RoutingData['geometry'] {
  return { type: 'LineString', coordinates: [[startLon, startLat], [endLon, endLat]] };
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
