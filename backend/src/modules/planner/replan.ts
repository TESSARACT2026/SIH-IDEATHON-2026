/**
 * "What If?" Dynamic Itinerary Simulator — Replan Endpoint
 *
 * Accepts a structured constraint delta and re-runs the SAME deterministic
 * planner engine with modified constraints. The LLM is never involved in
 * deciding the new schedule — it only narrates the diff afterward via
 * the existing /nlu/narrate endpoint.
 *
 * Supported delta types:
 *   - weather_change: swap outdoor stops for indoor alternatives
 *   - time_reduced: shorten the day or reduce number of days
 *   - crowd_increase: exclude HIGH crowd attractions in addition to SEVERE
 *   - budget_change: re-run with a budget ceiling or decrease, prefer cheaper options
 */

import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { generateItinerary, type PlannerOverrides, type PlannerInput, type PlanResult } from './engine.js';

const router = Router();

// ─── Constraint Delta Schema ─────────────────────────────────────────────────

const budgetChangePayloadSchema = z.object({
  /** New total ticket budget ceiling per person in INR */
  maxBudgetPerPerson: z.number().min(0).optional(),
  /** Reduce the current itinerary ticket budget by this amount per person in INR */
  decreaseByPerPerson: z.number().min(0).optional(),
}).strict().refine(
  (payload) => payload.maxBudgetPerPerson !== undefined || payload.decreaseByPerPerson !== undefined,
  { message: 'Provide maxBudgetPerPerson or decreaseByPerPerson' },
);

const constraintDeltaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('weather_change'),
    payload: z.object({
      condition: z.enum(['rain', 'extreme_heat', 'storm']),
      affectedDays: z.array(z.number().int().min(1).max(14)).optional(),
    }).strict(),
  }),
  z.object({
    type: z.literal('time_reduced'),
    payload: z.object({
      newDayEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      reduceDays: z.number().int().min(1).optional(),
    }).strict(),
  }),
  z.object({
    type: z.literal('crowd_increase'),
    payload: z.object({
      /** If true, exclude HIGH crowd level in addition to SEVERE */
      strictFilter: z.boolean().default(true),
    }).strict(),
  }),
  z.object({
    type: z.literal('budget_change'),
    payload: budgetChangePayloadSchema,
  }),
]);
export type ConstraintDelta = z.infer<typeof constraintDeltaSchema>;

const replanSchema = z.object({
  delta: constraintDeltaSchema,
}).strict();

const tripIdParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

const storedPlannerInputSchema = z.object({
  destinationId: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  days: z.number().int().min(1).max(14),
  title: z.string().min(1).max(200).optional(),
  saveTrip: z.boolean().optional(),
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
  }).strict(),
}).strict();

// ─── Delta → Overrides mapping ──────────────────────────────────────────────

export function estimateSnapshotBudgetPerPerson(items: unknown[]): number {
  return items.reduce<number>((sum, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return sum;

    const trustSummary = (item as Record<string, unknown>).trustSummary;
    if (!trustSummary || typeof trustSummary !== 'object' || Array.isArray(trustSummary)) return sum;

    const facts = (trustSummary as Record<string, unknown>).facts;
    if (!Array.isArray(facts)) return sum;

    const priceFact = facts.find((fact) => {
      if (!fact || typeof fact !== 'object' || Array.isArray(fact)) return false;
      const record = fact as Record<string, unknown>;
      return record.fact_key === 'ticket_price' &&
        (record.verification_status === 'VERIFIED' || record.verification_status === 'LIVE');
    });

    if (!priceFact || typeof priceFact !== 'object' || Array.isArray(priceFact)) return sum;
    const factValue = (priceFact as Record<string, unknown>).fact_value;
    if (!factValue || typeof factValue !== 'object' || Array.isArray(factValue)) return sum;

    const amount = (factValue as Record<string, unknown>).amount;
    return typeof amount === 'number' && Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
}

export function deltaToOverrides(delta: ConstraintDelta, currentBudgetPerPerson = 0): PlannerOverrides {
  switch (delta.type) {
    case 'weather_change':
      return { indoorOnly: true, indoorOnlyDays: delta.payload.affectedDays };
    case 'time_reduced':
      return {
        dayEndOverride: delta.payload.newDayEnd,
      };
    case 'crowd_increase':
      return { strictCrowdFilter: delta.payload.strictFilter };
    case 'budget_change':
      return {
        budgetCeilingPerPerson: delta.payload.maxBudgetPerPerson ??
          Math.max(0, currentBudgetPerPerson - (delta.payload.decreaseByPerPerson ?? 0)),
      };
    default:
      return {};
  }
}

export function restorePlannerInputForReplan(
  storedValue: unknown,
  fallback: PlannerInput,
): PlannerInput {
  const parsed = storedPlannerInputSchema.safeParse(storedValue);
  if (!parsed.success) return fallback;

  return {
    ...parsed.data,
    destinationId: fallback.destinationId,
    startDate: fallback.startDate,
    endDate: fallback.endDate,
    days: fallback.days,
    saveTrip: false,
  };
}

// ─── POST /api/v1/trips/:id/itinerary/replan ────────────────────────────────

router.post('/:id/itinerary/replan', requireAuth, async (req, res, next) => {
  try {
    const { id } = tripIdParamSchema.parse(req.params);
    const { delta } = replanSchema.parse(req.body);

    // Fetch the trip and verify ownership
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        destination: true,
        itineraries: {
          select: { plannerInput: true },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!trip || trip.userId !== req.user!.userId) {
      throw new AppError('Trip not found', 404, 'NOT_FOUND');
    }

    // Reconstruct planner input from the saved trip
    const snapshot = trip.itinerarySnapshot as Record<string, unknown> | null;
    const tripDays = snapshot?.days as number ??
      Math.max(1, Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const fallbackPlannerInput: PlannerInput = {
      destinationId: trip.destinationId,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate.toISOString(),
      days: tripDays,
      preferences: {
        pace: 'MODERATE',
        accessibilityWheelchair: false,
        accessibilityVision: false,
        accessibilityHearing: false,
        accessibilityCognitive: false,
        interests: [],
        transportPreference: 'MIXED',
      },
    };
    const plannerInput = restorePlannerInputForReplan(
      trip.plannerInput ?? trip.itineraries[0]?.plannerInput ?? null,
      fallbackPlannerInput,
    );

    // Capture the old itinerary for diff
    const oldItems = snapshot
      ? (Array.isArray((snapshot as Record<string, unknown>).itineraryItems) 
          ? (snapshot as Record<string, unknown>).itineraryItems as unknown[] 
          : [])
      : [];

    // Compute overrides from the delta
    const overrides = deltaToOverrides(delta, estimateSnapshotBudgetPerPerson(oldItems));

    // Handle reduceDays for time_reduced
    if (delta.type === 'time_reduced' && delta.payload.reduceDays) {
      overrides.daysOverride = Math.max(1, tripDays - delta.payload.reduceDays);
    }

    // Generate new itinerary using the SAME deterministic engine
    const newPlan: PlanResult = await generateItinerary(plannerInput, overrides);
    const newPlanSnapshot = { ...newPlan, plannerInput, replanDelta: delta };

    // Build diff summary
    const oldNames = new Set(
      (oldItems as Array<{ attractionName?: string }>).map((i) => i.attractionName).filter(Boolean)
    );
    const newNames = new Set(newPlan.itineraryItems.map((i) => i.attractionName));
    const added = newPlan.itineraryItems.filter((i) => !oldNames.has(i.attractionName));
    const removed = (oldItems as Array<{ attractionName?: string; entityId?: string }>)
      .filter((i) => i.attractionName && !newNames.has(i.attractionName));

    const diff = {
      added: added.map((i) => ({ name: i.attractionName, day: i.dayNumber, time: `${i.startTime}-${i.endTime}` })),
      removed: removed.map((i) => ({ name: i.attractionName ?? 'Unknown', entityId: i.entityId })),
      deltaApplied: delta,
      constraintsApplied: overrides,
    };

    const savedItinerary = await prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id },
        data: {
          plannerInput: plannerInput as unknown as Prisma.InputJsonValue,
          itinerarySnapshot: newPlanSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      const itinerary = await tx.itinerary.create({
        data: {
          tripId: id,
          plannerInput: plannerInput as unknown as Prisma.InputJsonValue,
          rawPlan: newPlanSnapshot as unknown as Prisma.InputJsonValue,
          validated: true,
        },
      });

      if (newPlan.itineraryItems.length > 0) {
        await tx.itineraryItem.createMany({
          data: newPlan.itineraryItems.map((item) => ({
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

      return itinerary;
    });

    res.json({
      data: {
        oldItemCount: oldItems.length,
        newPlan: newPlanSnapshot,
        diff,
        savedItineraryId: savedItinerary.id,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid replan request',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    next(err);
  }
});

export default router;
