import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import {
  getHotelCapabilityStatus,
  getHotelProviderStatuses,
  hotelUnavailableState,
} from './provider-status.js';
import {
  bookingLinkQuerySchema,
  hotelDetailsParamsSchema,
  hotelOffersQuerySchema,
  hotelSearchQuerySchema,
} from './schemas.js';
import { getHotelDetails, searchHotels } from './discovery.js';
import { buildHotelOffersResponse, getHotelOffers, safeBookingLink } from './staying.js';

const router = Router();

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

router.get('/offers', validate(hotelOffersQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await getHotelOffers(req.query as unknown as Parameters<typeof getHotelOffers>[0]));
  } catch (err) {
    next(err);
  }
});

router.get('/booking-link', validate(bookingLinkQuerySchema, 'query'), (req, res) => {
  const { url } = req.query as unknown as { url: string };
  res.json({ data: safeBookingLink(url) });
});

router.get('/:id', validate(hotelDetailsParamsSchema, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as { id: string };
    res.json(await getHotelDetails(id));
  } catch (err) {
    next(err);
  }
});

export default router;
export { buildHotelOffersResponse, getHotelCapabilityStatus, getHotelOffers, getHotelProviderStatuses, hotelUnavailableState, safeBookingLink };
