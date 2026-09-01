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
 *   - budget_change: re-run with a budget ceiling, prefer cheaper options
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

const constraintDeltaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('weather_change'),
    payload: z.object({
      condition: z.enum(['rain', 'extreme_heat', 'storm']),
      affectedDays: z.array(z.number().int().min(1)).optional(),
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
    payload: z.object({
      /** New budget ceiling per person in INR */
      maxBudgetPerPerson: z.number().min(0),
    }).strict(),
  }),
]).and(z.object({ type: z.string() }));

const replanSchema = z.object({
  delta: constraintDeltaSchema,
}).strict();

const tripIdParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

// ─── Delta → Overrides mapping ──────────────────────────────────────────────

function deltaToOverrides(delta: z.infer<typeof constraintDeltaSchema>): PlannerOverrides {
  switch (delta.type) {
    case 'weather_change':
      return { indoorOnly: true };
    case 'time_reduced':
      return {
        dayEndOverride: delta.payload.newDayEnd,
        daysOverride: delta.payload.reduceDays ? undefined : undefined,
        // reduceDays handled below
      };
    case 'crowd_increase':
      return { strictCrowdFilter: delta.payload.strictFilter };
    case 'budget_change':
      return { budgetCeilingPerPerson: delta.payload.maxBudgetPerPerson };
    default:
      return {};
  }
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
      },
    });

    if (!trip || trip.userId !== req.user!.userId) {
      throw new AppError('Trip not found', 404, 'NOT_FOUND');
    }

    // Reconstruct planner input from the saved trip
    const snapshot = trip.itinerarySnapshot as Record<string, unknown> | null;
    const tripDays = snapshot?.days as number ??
      Math.max(1, Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const plannerInput: PlannerInput = {
      destinationId: trip.destinationId,
      startDate: trip.startDate.toISOString(),
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

    // Compute overrides from the delta
    const overrides = deltaToOverrides(delta);

    // Handle reduceDays for time_reduced
    if (delta.type === 'time_reduced' && delta.payload.reduceDays) {
      overrides.daysOverride = Math.max(1, tripDays - delta.payload.reduceDays);
    }

    // Capture the old itinerary for diff
    const oldItems = snapshot
      ? (Array.isArray((snapshot as Record<string, unknown>).itineraryItems) 
          ? (snapshot as Record<string, unknown>).itineraryItems as unknown[] 
          : [])
      : [];

    // Generate new itinerary using the SAME deterministic engine
    const newPlan: PlanResult = await generateItinerary(plannerInput, overrides);

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
    };

    // Update the trip snapshot with the new plan
    await prisma.trip.update({
      where: { id },
      data: {
        itinerarySnapshot: newPlan as unknown as Prisma.InputJsonValue,
      },
    });

    res.json({
      data: {
        oldItemCount: oldItems.length,
        newPlan,
        diff,
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
