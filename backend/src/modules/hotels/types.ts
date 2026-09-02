export type HotelCapability = 'DISCOVERY' | 'DETAILS' | 'OFFERS';

export type HotelProviderStatusCode =
  | 'READY'
  | 'MISSING_API_KEY'
  | 'IMPLEMENTATION_PENDING'
  | 'FUTURE_PARTNER_ACCESS_REQUIRED';

export interface HotelProviderStatus {
  provider: string;
  capabilities: HotelCapability[];
  configured: boolean;
  implemented: boolean;
  status: HotelProviderStatusCode;
  requiredEnv: string[];
  nextPhase: number | 'future';
}

export interface HotelCapabilityStatus {
  capability: HotelCapability;
  available: boolean;
  providers: HotelProviderStatus[];
}

export interface HotelUnavailableState {
  code: string;
  message: string;
  action: 'CONFIGURE_PROVIDER_KEY' | 'WAIT_FOR_PROVIDER_IMPLEMENTATION' | 'REQUEST_PARTNER_ACCESS' | 'RETRY_LATER';
}

export interface HotelSourceAttribution {
  provider: string;
  name: string;
  attribution: string;
  url?: string;
  fetchedAt: string;
}

export interface HotelOffer {
  id: string;
  provider: 'STAYING';
  platform: string | null;
  providerHotelId: string | null;
  hotelName: string | null;
  roomName: string | null;
  currency: string;
  nightlyAmount: number | null;
  totalAmount: number | null;
  taxesAndFeesAmount: number | null;
  nights: number;
  rooms: number;
  adults: number;
  bookingUrl: string | null;
  refundable: boolean | null;
  source: HotelSourceAttribution;
  confidence: 'LIVE_PROVIDER' | 'PARTIAL_PROVIDER' | 'SANDBOX_SAMPLE';
}

export interface HotelTripFit {
  score: number;
  averageDistanceKm: number | null;
  nearestStopDistanceKm: number | null;
  reasons: string[];
}

export interface HotelDiscoveryItem {
  id: string;
  provider: 'GEOAPIFY' | 'OPENSTREETMAP' | 'STAYING';
  providerHotelId: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string | null;
  categories: string[];
  amenities: string[];
  phone: string | null;
  website: string | null;
  starRating: number | null;
  wheelchairAccessible: boolean | null;
  source: HotelSourceAttribution;
  pricing: {
    available: false;
    message: string;
  };
  trust: {
    status: 'SOURCE_BACKED';
    confidence: number;
    warnings: string[];
    summary: {
      label: 'HIGH' | 'MEDIUM' | 'LOW';
      score: number;
      sourceTier: 'PROVIDER_PLACE_DATA' | 'OPENSTREETMAP_COMMUNITY';
      fieldCompleteness: number;
      freshness: {
        status: 'FRESH' | 'RECENT' | 'STALE' | 'UNKNOWN';
        score: number;
        fetchedAt: string;
      };
      evidenceCount: number;
      missingFields: string[];
    };
  };
  tripFit?: HotelTripFit;
}
