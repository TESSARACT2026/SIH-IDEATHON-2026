import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const booleanQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true');

function requireDateRange(checkIn: string | undefined, checkOut: string | undefined, ctx: z.RefinementCtx) {
  if (Boolean(checkIn) !== Boolean(checkOut)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: checkIn ? ['checkOut'] : ['checkIn'],
      message: 'Provide both checkIn and checkOut, or neither.',
    });
  }

  if (checkIn && checkOut && checkOut <= checkIn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkOut'],
      message: 'checkOut must be after checkIn.',
    });
  }
}

export const hotelSearchQuerySchema = z.object({
  destinationId: z.string().trim().min(1).max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(50).default(5),
  checkIn: isoDateSchema.optional(),
  checkOut: isoDateSchema.optional(),
  adults: z.coerce.number().int().min(1).max(10).default(2),
  rooms: z.coerce.number().int().min(1).max(5).default(1),
  priceBand: z.enum(['BUDGET', 'MODERATE', 'PREMIUM']).optional(),
  amenities: z.string().trim().max(200).optional(),
  type: z.enum(['hotel', 'guest_house', 'hostel', 'motel', 'apartment']).optional(),
  wheelchairAccessible: booleanQuerySchema.optional(),
  wifi: booleanQuerySchema.optional(),
  parking: booleanQuerySchema.optional(),
  sort: z.enum(['DISTANCE', 'TRUST', 'RECOMMENDED']).default('DISTANCE'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict().superRefine((query, ctx) => {
  const hasLat = query.lat !== undefined;
  const hasLon = query.lon !== undefined;

  if (hasLat !== hasLon) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: hasLat ? ['lon'] : ['lat'],
      message: 'Provide both lat and lon, or neither.',
    });
  }

  if (!query.destinationId && (!hasLat || !hasLon)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['destinationId'],
      message: 'Provide destinationId or both lat and lon.',
    });
  }

  requireDateRange(query.checkIn, query.checkOut, ctx);
});

export const hotelDetailsParamsSchema = z.object({
  id: z.string().trim().min(1).max(150),
}).strict();

export const hotelOffersQuerySchema = z.object({
  hotelId: z.string().trim().min(1).max(150),
  providerHotelId: z.string().trim().min(1).max(200).optional(),
  platform: z.enum(['airbnb', 'booking', 'vrbo', 'expedia', 'hotels', 'google', 'tripadvisor']).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  location: z.string().trim().min(1).max(200).optional(),
  googleHotelId: z.string().trim().min(1).max(200).optional(),
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  adults: z.coerce.number().int().min(1).max(10).default(2),
  rooms: z.coerce.number().int().min(1).max(5).default(1),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  limit: z.coerce.number().int().min(1).max(10).default(5),
}).strict().superRefine((query, ctx) => {
  requireDateRange(query.checkIn, query.checkOut, ctx);
});

export const bookingLinkQuerySchema = z.object({
  url: z.string().trim().url(),
}).strict();

export const selectedHotelSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(200),
  provider: z.string().trim().min(1).max(40),
  providerHotelId: z.string().trim().min(1).max(250).optional(),
  name: z.string().trim().min(1).max(250),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().trim().max(500).nullable().optional(),
  categories: z.array(z.string().max(100)).max(30).optional(),
  amenities: z.array(z.string().max(100)).max(50).optional(),
  pricing: z.record(z.unknown()).optional(),
  trust: z.record(z.unknown()).optional(),
}).passthrough();

export const saveTripHotelSchema = z.object({
  hotel: selectedHotelSnapshotSchema,
  offer: z.record(z.unknown()).optional(),
}).strict();
