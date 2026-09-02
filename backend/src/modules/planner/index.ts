import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { getHolidays } from '../services/index.js';
import { getWeatherWarnings } from '../live-data/weather.js';
import { optionalAuth } from '../../shared/middleware/auth.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';
import { generateItinerary } from './engine.js';

const router = Router();

const plannerInputSchema = z.object({
  destinationId: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  days: z.number().int().min(1).max(14),
  title: z.string().min(1).max(200).optional(),
  saveTrip: z.boolean().default(false).optional(),
  preferences: z.object({
    pace: z.enum(['RELAXED', 'MODERATE', 'PACKED']).default('MODERATE'),
    accessibilityWheelchair: z.boolean().default(false),
    accessibilityVision: z.boolean().default(false),
    accessibilityHearing: z.boolean().default(false),
    accessibilityCognitive: z.boolean().default(false),
    interests: z.array(z.string().max(50)).max(20).default([]),
    transportPreference: z.enum(['WALKING', 'PUBLIC_TRANSIT', 'CAB', 'OWN_VEHICLE', 'MIXED']).default('MIXED'),
    groupType: z.enum(['SOLO', 'COUPLE', 'FAMILY', 'GROUP']).default('SOLO').optional(),
    walkingToleranceMinutes: z.number().int().min(5).max(240).default(30).optional(),
    indoorOutdoorPreference: z.enum(['indoor', 'outdoor', 'mixed']).default('mixed').optional(),
    localBusinessPreference: z.boolean().default(false).optional(),
    budgetBand: z.enum(['BUDGET', 'MODERATE', 'PREMIUM']).default('MODERATE').optional(),
    preferredStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('09:00').optional(),
  }).strict(),
}).strict();

const tripEndDate = (input: z.infer<typeof plannerInputSchema>, tripStart: Date) => {
  if (input.endDate) return new Date(input.endDate);

  const tripEnd = new Date(tripStart);
  tripEnd.setDate(tripStart.getDate() + input.days - 1);
  tripEnd.setHours(18, 0, 0, 0);
  return tripEnd;
};

router.post('/generate', optionalAuth, async (req, res, next) => {
  try {
    const parsedInput = plannerInputSchema.parse(req.body);
    const input = { ...parsedInput, destinationId: resolveDestinationId(parsedInput.destinationId) };
    const tripStart = new Date(input.startDate);
    const saveTrip = input.saveTrip === true;

    if (saveTrip && !req.user) {
      throw new AppError('Authentication required to save generated trips', 401, 'UNAUTHORIZED');
    }

    const endDate = tripEndDate(input, tripStart);
    if (saveTrip && endDate <= tripStart) {
      throw new AppError('End date must be after start date', 400, 'INVALID_DATES');
    }

    // Generate itinerary using the deterministic engine
    const plan = await generateItinerary(input);

    // Weather-Aware Warnings (Feature 5)
    try {
      const destination = await prisma.destination.findUnique({ where: { id: input.destinationId } });
      if (destination) {
        const tripEnd = new Date(tripStart);
        tripEnd.setDate(tripStart.getDate() + input.days - 1);
        const weatherWarnings = await getWeatherWarnings(
          destination.latitude,
          destination.longitude,
          tripStart,
          tripEnd
        );
        plan.warnings.push(...weatherWarnings);
      }
    } catch {
      // Fail silently if weather fails
    }

    // Public Holiday Crowd Risk Warning (Nager.Date integration)
    try {
      const tripYear = tripStart.getFullYear();
      const holidays = await getHolidays('IN', tripYear);
      
      for (let day = 0; day < input.days; day++) {
        const currentDate = new Date(tripStart);
        currentDate.setDate(currentDate.getDate() + day);
        const dateString = currentDate.toISOString().split('T')[0];
        
        const holiday = holidays.find((h: any) => h.date === dateString);
        if (holiday) {
          plan.warnings.push(`High Crowd Risk: Day ${day + 1} falls on a public holiday (${holiday.name})`);
        }
      }
    } catch {
      // Ignore if holiday fetch fails
    }

    const planResponse = { ...plan, plannerInput: input };

    const savedTrip = saveTrip
      ? await prisma.$transaction(async (tx) => {
          const plannerInput = input as unknown as Prisma.InputJsonValue;
          const planSnapshot = planResponse as unknown as Prisma.InputJsonValue;
          const trip = await tx.trip.create({
            data: {
              userId: req.user!.userId,
              destinationId: input.destinationId,
              title: input.title ?? 'Generated Trip',
              startDate: tripStart,
              endDate,
              status: 'PLANNED',
              plannerInput,
              itinerarySnapshot: planSnapshot,
            },
          });

          const itinerary = await tx.itinerary.create({
            data: {
              tripId: trip.id,
              plannerInput,
              rawPlan: planSnapshot,
              validated: true,
            },
          });

          if (plan.itineraryItems.length > 0) {
            await tx.itineraryItem.createMany({
              data: plan.itineraryItems.map((item) => ({
                itineraryId: itinerary.id,
                dayNumber: item.dayNumber,
                sequence: item.sequence,
                startTime: item.startTime,
                endTime: item.endTime,
                entityType: item.entityType,
                entityId: item.entityId,
                travelBufferMinutesBefore: item.travelBufferMinutesBefore,
                trustSummary: item.trustSummary as Prisma.InputJsonValue,
              })),
            });
          }

          return { tripId: trip.id, itineraryId: itinerary.id };
        })
      : undefined;

    res.json({ data: { ...planResponse, ...(savedTrip ? { savedTrip } : {}) } });
  } catch (err) {
    next(err);
  }
});

export default router;
