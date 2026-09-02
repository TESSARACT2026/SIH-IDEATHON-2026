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

export interface HotelDiscoveryItem {
  id: string;
  provider: 'GEOAPIFY' | 'OPENSTREETMAP';
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
  };
}
