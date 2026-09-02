import { describe, expect, it } from 'vitest';
import {
  buildHotelOffersResponse,
  getHotelCapabilityStatus,
  getHotelProviderStatuses,
} from '../src/modules/hotels/index.js';
import {
  buildHotelDiscoveryPayload,
  dedupeHotels,
  normalizeGeoapifyHotel,
  normalizeOverpassHotel,
} from '../src/modules/hotels/discovery.js';
import { hotelSearchQuerySchema } from '../src/modules/hotels/schemas.js';

describe('hotel phase 0 contract', () => {
  it('reports provider readiness without making external calls', () => {
    const providers = getHotelProviderStatuses();

    expect(providers.map((provider) => provider.provider)).toEqual([
      'Geoapify Places',
      'OpenStreetMap/Overpass',
      'Geoapify Place Details',
      'Amadeus',
      'Booking.com Demand API',
    ]);
    expect(getHotelCapabilityStatus('DISCOVERY').available).toBe(true);
    expect(getHotelCapabilityStatus('DETAILS').available).toBe(false);
    expect(getHotelCapabilityStatus('OFFERS').available).toBe(false);
  });

  it('validates hotel search location and date contracts', () => {
    const response = hotelSearchQuerySchema.safeParse({
      lat: 20.2961,
      checkIn: '2026-09-08',
      checkOut: '2026-09-05',
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      const errors = response.error.flatten().fieldErrors;
      expect(errors.lon).toBeDefined();
      expect(errors.checkOut).toBeDefined();
    }
  });

  it('returns an honest unavailable offers response instead of fake prices', () => {
    const response = buildHotelOffersResponse({
      hotelId: 'hotel-1',
      checkIn: '2026-09-05',
      checkOut: '2026-09-08',
    });

    expect(response.data.offers).toEqual([]);
    expect(response.data.unavailable.code).toMatch(/^HOTEL_OFFERS_/);
    expect(response.data.providerStatus.available).toBe(false);
  });
});

describe('hotel phase 1 discovery', () => {
  const center = { latitude: 20.2961, longitude: 85.8245, label: 'Bhubaneswar' };

  it('normalizes Geoapify hotel results without inventing prices', () => {
    const hotel = normalizeGeoapifyHotel({
      properties: {
        place_id: 'geo-1',
        name: 'Hotel Utkal',
        formatted: 'Janpath, Bhubaneswar',
        categories: ['accommodation.hotel'],
        datasource: { raw: { stars: '3', internet_access: 'wlan', wheelchair: 'yes' } },
      },
      geometry: { coordinates: [85.825, 20.297] },
    }, center, '2026-09-02T10:00:00.000Z');

    expect(hotel?.id).toBe('geoapify:geo-1');
    expect(hotel?.amenities).toContain('wifi');
    expect(hotel?.wheelchairAccessible).toBe(true);
    expect(hotel?.pricing.available).toBe(false);
  });

  it('normalizes Overpass hotel results with OpenStreetMap attribution', () => {
    const hotel = normalizeOverpassHotel({
      type: 'node',
      id: 123,
      lat: 20.297,
      lon: 85.825,
      tags: {
        name: 'Hotel Kalinga',
        tourism: 'hotel',
        'addr:city': 'Bhubaneswar',
        internet_access: 'wlan',
      },
    }, center, '2026-09-02T10:00:00.000Z');

    expect(hotel?.id).toBe('osm:node/123');
    expect(hotel?.source.attribution).toContain('OpenStreetMap');
    expect(hotel?.pricing.available).toBe(false);
  });

  it('deduplicates nearby hotels with the same normalized name', () => {
    const first = normalizeOverpassHotel({
      type: 'node',
      id: 1,
      lat: 20.297,
      lon: 85.825,
      tags: { name: 'Hotel Kalinga', tourism: 'hotel' },
    }, center, '2026-09-02T10:00:00.000Z');
    const duplicate = normalizeOverpassHotel({
      type: 'node',
      id: 2,
      lat: 20.2972,
      lon: 85.8252,
      tags: { name: 'Hotel   Kalinga!', tourism: 'hotel' },
    }, center, '2026-09-02T10:00:00.000Z');

    expect(dedupeHotels([first!, duplicate!])).toHaveLength(1);
  });

  it('uses Overpass fallback when Geoapify is not configured', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      elements: [{
        type: 'node',
        id: 123,
        lat: 20.297,
        lon: 85.825,
        tags: { name: 'Hotel Kalinga', tourism: 'hotel' },
      }],
    }), { status: 200 });

    const payload = await buildHotelDiscoveryPayload(center, { radiusKm: 5, limit: 10 }, fetchImpl as typeof fetch);

    expect(payload.hotels).toHaveLength(1);
    expect(payload.sourceMix.OPENSTREETMAP).toBe(1);
    expect(payload.warnings).toContain('GEOAPIFY_API_KEY is missing; OpenStreetMap/Overpass fallback was used for discovery.');
  });

});
