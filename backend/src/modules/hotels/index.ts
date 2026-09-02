import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import {
  getHotelCapabilityStatus,
  getHotelProviderStatuses,
  hotelUnavailableState,
} from './provider-status.js';
import {
  hotelDetailsParamsSchema,
  hotelOffersQuerySchema,
  hotelSearchQuerySchema,
} from './schemas.js';
import { searchHotels } from './discovery.js';

const router = Router();

export function buildHotelOffersResponse(meta: unknown) {
  return {
    data: {
      offers: [],
      unavailable: hotelUnavailableState('OFFERS'),
      providerStatus: getHotelCapabilityStatus('OFFERS'),
    },
    meta,
  };
}

export function buildHotelDetailsUnavailableResponse(meta: unknown) {
  const unavailable = hotelUnavailableState('DETAILS');

  return {
    error: {
      code: unavailable.code,
      message: unavailable.message,
    },
    providerStatus: getHotelCapabilityStatus('DETAILS'),
    meta,
  };
}

router.get('/providers', (_req, res) => {
  res.json({
    data: {
      providers: getHotelProviderStatuses(),
      capabilities: {
        discovery: getHotelCapabilityStatus('DISCOVERY'),
        details: getHotelCapabilityStatus('DETAILS'),
        offers: getHotelCapabilityStatus('OFFERS'),
      },
    },
  });
});

router.get('/search', validate(hotelSearchQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await searchHotels(req.query as unknown as Parameters<typeof searchHotels>[0]));
  } catch (err) {
    next(err);
  }
});

router.get('/offers', validate(hotelOffersQuerySchema, 'query'), (req, res) => {
  res.json(buildHotelOffersResponse(req.query));
});

router.get('/:id', validate(hotelDetailsParamsSchema, 'params'), (req, res) => {
  res.status(503).json(buildHotelDetailsUnavailableResponse(req.params));
});

export default router;
export { getHotelCapabilityStatus, getHotelProviderStatuses, hotelUnavailableState };
