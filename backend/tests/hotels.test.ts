import { describe, expect, it } from 'vitest';
import {
  buildHotelOffersResponse,
  getHotelOffers,
  getHotelCapabilityStatus,
  getHotelProviderStatuses,
  safeBookingLink,
} from '../src/modules/hotels/index.js';
import {
  buildHotelDiscoveryPayload,
  dedupeHotels,
  decodeHotelProviderId,
  getHotelDetails,
  normalizeGeoapifyHotel,
  normalizeOverpassHotel,
  rankHotelsForTrip,
} from '../src/modules/hotels/discovery.js';
import { accommodationAmountFromSelectedHotel, selectedHotelFromSnapshot, withSelectedHotel, withoutSelectedHotel } from '../src/modules/hotels/selection.js';
import { hotelSearchQuerySchema } from '../src/modules/hotels/schemas.js';
import { env } from '../src/shared/config/index.js';

describe('hotel phase 0 contract', () => {
  it('reports provider readiness without making external calls', () => {
    const originalStayingKey = env.STAYING_API_KEY;
    env.STAYING_API_KEY = '';

    try {
      const providers = getHotelProviderStatuses();

      expect(providers.map((provider) => provider.provider)).toEqual([
        'Geoapify Places',
        'OpenStreetMap/Overpass',
        'Geoapify Place Details',
        'OpenStreetMap/Overpass Details',
        'Staying API',
        'Booking.com Demand API',
      ]);
      expect(getHotelCapabilityStatus('DISCOVERY').available).toBe(true);
      expect(getHotelCapabilityStatus('DETAILS').available).toBe(true);
      expect(getHotelCapabilityStatus('OFFERS').available).toBe(false);
    } finally {
      env.STAYING_API_KEY = originalStayingKey;
    }
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

  it('validates the new hotel discovery filters', () => {
    const response = hotelSearchQuerySchema.safeParse({
      lat: 20.2961,
      lon: 85.8245,
      wheelchairAccessible: 'true',
      wifi: 'true',
      parking: 'false',
      type: 'hotel',
      sort: 'RECOMMENDED',
    });

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.wheelchairAccessible).toBe(true);
      expect(response.data.wifi).toBe(true);
      expect(response.data.parking).toBe(false);
    }
  });

  it('returns an honest unavailable offers response instead of fake prices', () => {
    const originalStayingKey = env.STAYING_API_KEY;
    env.STAYING_API_KEY = '';

    try {
      const response = buildHotelOffersResponse({
        hotelId: 'hotel-1',
        checkIn: '2026-09-05',
        checkOut: '2026-09-08',
      });

      expect(response.data.offers).toEqual([]);
      expect(response.data.unavailable.code).toMatch(/^HOTEL_OFFERS_/);
      expect(response.data.providerStatus.available).toBe(false);
    } finally {
      env.STAYING_API_KEY = originalStayingKey;
    }
  });

  it('recognizes a configured Staying API key as the implemented offers provider', () => {
    const originalStayingKey = env.STAYING_API_KEY;
    env.STAYING_API_KEY = 'test-staying-key';

    try {
      const offers = getHotelCapabilityStatus('OFFERS');
      const staying = offers.providers.find((provider) => provider.provider === 'Staying API');
      const response = buildHotelOffersResponse({
        hotelId: 'hotel-1',
        checkIn: '2026-09-05',
        checkOut: '2026-09-08',
      });

      expect(staying?.configured).toBe(true);
      expect(staying?.implemented).toBe(true);
      expect(staying?.status).toBe('READY');
      expect(offers.available).toBe(true);
      expect(response.data.unavailable.code).toBe('HOTEL_OFFERS_TEMPORARILY_UNAVAILABLE');
    } finally {
      env.STAYING_API_KEY = originalStayingKey;
    }
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
    expect(hotel?.trust.summary.sourceTier).toBe('PROVIDER_PLACE_DATA');
    expect(hotel?.trust.summary.fieldCompleteness).toBeGreaterThan(0.5);
    expect(hotel?.trust.confidence).toBe(hotel?.trust.summary.score);
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
    expect(hotel?.trust.summary.sourceTier).toBe('OPENSTREETMAP_COMMUNITY');
    expect(hotel?.trust.summary.missingFields).toContain('phone');
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
    const originalGeoapifyKey = env.GEOAPIFY_API_KEY;
    env.GEOAPIFY_API_KEY = '';

    const fetchImpl = async () => new Response(JSON.stringify({
      elements: [{
        type: 'node',
        id: 123,
        lat: 20.297,
        lon: 85.825,
        tags: { name: 'Hotel Kalinga', tourism: 'hotel' },
      }],
    }), { status: 200 });

    try {
      const payload = await buildHotelDiscoveryPayload(center, { radiusKm: 5, limit: 10 }, fetchImpl as typeof fetch);

      expect(payload.hotels).toHaveLength(1);
      expect(payload.sourceMix.OPENSTREETMAP).toBe(1);
      expect(payload.warnings).toContain('GEOAPIFY_API_KEY is missing; OpenStreetMap/Overpass fallback was used for discovery.');
    } finally {
      env.GEOAPIFY_API_KEY = originalGeoapifyKey;
    }
  });

  it('filters and sorts discovered hotels by requested backend filters', async () => {
    const originalGeoapifyKey = env.GEOAPIFY_API_KEY;
    env.GEOAPIFY_API_KEY = '';

    const fetchImpl = async () => new Response(JSON.stringify({
      elements: [
        {
          type: 'node',
          id: 123,
          lat: 20.297,
          lon: 85.825,
          tags: { name: 'Hotel Kalinga', tourism: 'hotel', wheelchair: 'yes', internet_access: 'wlan' },
        },
        {
          type: 'node',
          id: 124,
          lat: 20.298,
          lon: 85.826,
          tags: { name: 'Guest Stay', tourism: 'guest_house', wheelchair: 'no' },
        },
      ],
    }), { status: 200 });

    try {
      const payload = await buildHotelDiscoveryPayload(center, {
        radiusKm: 5,
        limit: 10,
        type: 'hotel',
        wheelchairAccessible: true,
        wifi: true,
        parking: false,
        sort: 'TRUST',
      }, fetchImpl as typeof fetch);

      expect(payload.hotels).toHaveLength(1);
      expect(payload.hotels[0].name).toBe('Hotel Kalinga');
    } finally {
      env.GEOAPIFY_API_KEY = originalGeoapifyKey;
    }
  });

});

describe('hotel phase 2 details', () => {
  it('decodes only provider-backed hotel ids', () => {
    expect(decodeHotelProviderId('geoapify:abc')).toEqual({ provider: 'GEOAPIFY', id: 'abc' });
    expect(decodeHotelProviderId('osm:node/123')).toEqual({ provider: 'OPENSTREETMAP', osmType: 'node', osmId: '123' });
    expect(() => decodeHotelProviderId('hotel-1')).toThrow('Unsupported hotel id');
  });

  it('fetches Geoapify details by place id without adding prices', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      features: [{
        properties: {
          feature_type: 'details',
          place_id: 'geo-1',
          name: 'Hotel Utkal',
          formatted: 'Janpath, Bhubaneswar',
          categories: ['accommodation.hotel'],
          contact: { phone: '+911234567890' },
          internet_access: true,
          wheelchair: true,
        },
        geometry: { coordinates: [85.825, 20.297] },
      }],
    }), { status: 200 });

    const response = await getHotelDetails('geoapify:geo-1', fetchImpl as typeof fetch);

    expect(response.data.hotel.name).toBe('Hotel Utkal');
    expect(response.data.hotel.phone).toBe('+911234567890');
    expect(response.data.hotel.pricing.available).toBe(false);
    expect(response.data.providerStatus.available).toBe(true);
  });

  it('fetches OpenStreetMap details by OSM id', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      elements: [{
        type: 'node',
        id: 123,
        lat: 20.297,
        lon: 85.825,
        tags: {
          name: 'Hotel Kalinga',
          tourism: 'hotel',
          phone: '+911234567890',
        },
      }],
    }), { status: 200 });

    const response = await getHotelDetails('osm:node/123', fetchImpl as typeof fetch);

    expect(response.data.hotel.name).toBe('Hotel Kalinga');
    expect(response.data.hotel.provider).toBe('OPENSTREETMAP');
    expect(response.data.hotel.phone).toBe('+911234567890');
  });
});

describe('hotel phases 8-13 provider offers and booking links', () => {
  it('fetches a Staying direct price offer when platform and listing id are known', async () => {
    const originalStayingKey = env.STAYING_API_KEY;
    env.STAYING_API_KEY = 'stay_test_key';

    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      expect(url.pathname).toBe('/v1/price');
      expect(url.searchParams.get('platform')).toBe('booking');
      expect(url.searchParams.get('listingId')).toBe('hotel-123');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer stay_test_key');
      return new Response(JSON.stringify({
        data: {
          platform: 'booking',
          listingId: 'hotel-123',
          hotelName: 'Hotel Utkal',
          totalPrice: 3600,
          currency: 'INR',
          bookingUrl: 'https://www.booking.com/hotel/in/utkal.html',
        },
        meta: { warnings: [] },
      }), { status: 200 });
    };

    try {
      const response = await getHotelOffers({
        hotelId: 'staying:booking:hotel-123',
        checkIn: '2026-09-05',
        checkOut: '2026-09-07',
        adults: 2,
        rooms: 1,
        currency: 'INR',
        limit: 5,
      }, fetchImpl as typeof fetch);

      expect(response.data.offers[0]).toMatchObject({
        provider: 'STAYING',
        platform: 'booking',
        totalAmount: 3600,
        nightlyAmount: 1800,
        nights: 2,
      });
    } finally {
      env.STAYING_API_KEY = originalStayingKey;
    }
  });

  it('does not guess Staying mapping for Geoapify or OSM ids', async () => {
    const originalStayingKey = env.STAYING_API_KEY;
    env.STAYING_API_KEY = 'stay_test_key';

    try {
      const response = await getHotelOffers({
        hotelId: 'geoapify:place-1',
        checkIn: '2026-09-05',
        checkOut: '2026-09-07',
        adults: 2,
        rooms: 1,
        currency: 'INR',
        limit: 5,
      });

      expect(response.data.unavailable.code).toBe('HOTEL_OFFERS_MAPPING_REQUIRED');
      expect(response.data.offers).toEqual([]);
    } finally {
      env.STAYING_API_KEY = originalStayingKey;
    }
  });

  it('allows only approved HTTPS booking links', () => {
    expect(safeBookingLink('https://www.booking.com/hotel/in/utkal.html').allowed).toBe(true);
    expect(safeBookingLink('http://www.booking.com/hotel/in/utkal.html').allowed).toBe(false);
    expect(safeBookingLink('https://evil.example/hotel').allowed).toBe(false);
  });

  it('stores selected hotels in the trip snapshot without a schema migration', () => {
    const snapshot = withSelectedHotel({}, {
      id: 'staying:booking:hotel-123',
      provider: 'STAYING',
      name: 'Hotel Utkal',
      latitude: 20.297,
      longitude: 85.825,
    }, { totalAmount: 3600 }, '2026-09-02T00:00:00.000Z') as any;

    expect(selectedHotelFromSnapshot(snapshot)?.name).toBe('Hotel Utkal');
    expect(accommodationAmountFromSelectedHotel(snapshot)).toBe(3600);
    expect(selectedHotelFromSnapshot(withoutSelectedHotel(snapshot) as any)).toBeNull();
  });

  it('ranks hotels by itinerary fit', () => {
    const near = normalizeOverpassHotel({
      type: 'node',
      id: 1,
      lat: 20.297,
      lon: 85.825,
      tags: { name: 'Near Hotel', tourism: 'hotel', wheelchair: 'yes' },
    }, { latitude: 20.2961, longitude: 85.8245, label: 'Bhubaneswar' }, '2026-09-02T10:00:00.000Z')!;
    const far = normalizeOverpassHotel({
      type: 'node',
      id: 2,
      lat: 20.8,
      lon: 86.3,
      tags: { name: 'Far Hotel', tourism: 'hotel' },
    }, { latitude: 20.2961, longitude: 85.8245, label: 'Bhubaneswar' }, '2026-09-02T10:00:00.000Z')!;

    const ranked = rankHotelsForTrip([far, near], [{ latitude: 20.2961, longitude: 85.8245 }], { accessibilityWheelchair: true });
    expect(ranked[0].name).toBe('Near Hotel');
    expect(ranked[0].tripFit?.score).toBeGreaterThan(ranked[1].tripFit?.score ?? 0);
  });
});
