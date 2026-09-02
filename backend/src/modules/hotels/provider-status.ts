import { env } from '../../shared/config/index.js';
import type { HotelCapability, HotelCapabilityStatus, HotelProviderStatus, HotelUnavailableState } from './types.js';

function hasSecret(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function getHotelProviderStatuses(): HotelProviderStatus[] {
  return [
    {
      provider: 'Geoapify Places',
      capabilities: ['DISCOVERY'],
      configured: hasSecret(env.GEOAPIFY_API_KEY),
      implemented: true,
      status: hasSecret(env.GEOAPIFY_API_KEY) ? 'READY' : 'MISSING_API_KEY',
      requiredEnv: ['GEOAPIFY_API_KEY'],
      nextPhase: 1,
    },
    {
      provider: 'OpenStreetMap/Overpass',
      capabilities: ['DISCOVERY'],
      configured: true,
      implemented: true,
      status: 'READY',
      requiredEnv: [],
      nextPhase: 1,
    },
    {
      provider: 'Geoapify Place Details',
      capabilities: ['DETAILS'],
      configured: hasSecret(env.GEOAPIFY_API_KEY),
      implemented: false,
      status: hasSecret(env.GEOAPIFY_API_KEY) ? 'IMPLEMENTATION_PENDING' : 'MISSING_API_KEY',
      requiredEnv: ['GEOAPIFY_API_KEY'],
      nextPhase: 2,
    },
    {
      provider: 'Amadeus',
      capabilities: ['OFFERS'],
      configured: hasSecret(env.AMADEUS_CLIENT_ID) && hasSecret(env.AMADEUS_CLIENT_SECRET),
      implemented: false,
      status:
        hasSecret(env.AMADEUS_CLIENT_ID) && hasSecret(env.AMADEUS_CLIENT_SECRET)
          ? 'IMPLEMENTATION_PENDING'
          : 'MISSING_API_KEY',
      requiredEnv: ['AMADEUS_CLIENT_ID', 'AMADEUS_CLIENT_SECRET'],
      nextPhase: 3,
    },
    {
      provider: 'Booking.com Demand API',
      capabilities: ['OFFERS'],
      configured: hasSecret(env.BOOKING_DEMAND_API_KEY) && hasSecret(env.BOOKING_DEMAND_AFFILIATE_ID),
      implemented: false,
      status: 'FUTURE_PARTNER_ACCESS_REQUIRED',
      requiredEnv: ['BOOKING_DEMAND_API_KEY', 'BOOKING_DEMAND_AFFILIATE_ID'],
      nextPhase: 'future',
    },
  ];
}

export function getHotelCapabilityStatus(capability: HotelCapability): HotelCapabilityStatus {
  const providers = getHotelProviderStatuses().filter((provider) => provider.capabilities.includes(capability));

  return {
    capability,
    available: providers.some((provider) => provider.configured && provider.implemented),
    providers,
  };
}

export function hotelUnavailableState(capability: HotelCapability): HotelUnavailableState {
  const status = getHotelCapabilityStatus(capability);
  const plannedProviders = status.providers.filter((provider) => provider.nextPhase !== 'future');
  const hasReadyProvider = status.providers.some((provider) => provider.configured && provider.implemented);
  const hasConfiguredProvider = plannedProviders.some((provider) => provider.configured);
  const hasFutureOnlyProvider = status.providers.every((provider) => provider.status === 'FUTURE_PARTNER_ACCESS_REQUIRED');

  if (hasReadyProvider) {
    return {
      code: `HOTEL_${capability}_TEMPORARILY_UNAVAILABLE`,
      message: 'No hotel provider returned usable data for this request. Please try a different location or retry later.',
      action: 'RETRY_LATER',
    };
  }

  if (hasFutureOnlyProvider) {
    return {
      code: `HOTEL_${capability}_PARTNER_ACCESS_REQUIRED`,
      message: 'Hotel provider partner access is required before this capability can be enabled.',
      action: 'REQUEST_PARTNER_ACCESS',
    };
  }

  if (hasConfiguredProvider) {
    return {
      code: `HOTEL_${capability}_IMPLEMENTATION_PENDING`,
      message: 'Hotel provider credentials are present, but this backend provider adapter is not implemented yet.',
      action: 'WAIT_FOR_PROVIDER_IMPLEMENTATION',
    };
  }

  return {
    code: `HOTEL_${capability}_NOT_CONFIGURED`,
    message: 'Hotel provider credentials are not configured yet. Add the required API key environment variables to enable real hotel data in a later phase.',
    action: 'CONFIGURE_PROVIDER_KEY',
  };
}
