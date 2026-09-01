/**
 * Feature 4: Personal Tourism Impact Score
 *
 * Generates two itinerary variants for the same trip request:
 *   - "Popular route": baseline planner output
 *   - "Responsible route": planner re-run with crowd-avoidance and
 *     local-business-preference weights increased
 *
 * Both are independently valid, feasible itineraries from the real
 * deterministic planner — not a cosmetic relabeling of the same plan.
 *
 * Comparison metrics are computed from REAL differences between the two
 * generated plans, not invented percentages.
 *
 * See SCORING_METHODOLOGY.md for full documentation.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';
import { generateItinerary, type PlannerInput, type PlanResult } from '../planner/engine.js';

const router = Router();

const impactSchema = z.object({
  destinationId: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  days: z.number().int().min(1).max(14),
  preferences: z.object({
    pace: z.enum(['RELAXED', 'MODERATE', 'PACKED']).default('MODERATE'),
    accessibilityWheelchair: z.boolean().default(false),
    accessibilityVision: z.boolean().default(false),
    accessibilityHearing: z.boolean().default(false),
    accessibilityCognitive: z.boolean().default(false),
    interests: z.array(z.string().max(50)).max(20).default([]),
    transportPreference: z.enum(['WALKING', 'PUBLIC_TRANSIT', 'CAB', 'OWN_VEHICLE', 'MIXED']).default('MIXED'),
  }).strict(),
}).strict();

type ImpactMetrics = {
  popularRoute: {
    itemCount: number;
    avgCrowdLevel: string;
    highCrowdStops: number;
  };
  responsibleRoute: {
    itemCount: number;
    avgCrowdLevel: string;
    highCrowdStops: number;
    localBusinessStops: number;
  };
  comparison: {
    crowdPressureDelta: string;
    localBusinessDelta: number;
    message: string;
  };
};

// Count crowd levels from itinerary items by looking up the attractions
async function countCrowdMetrics(plan: PlanResult) {
  const entityIds = plan.itineraryItems.map((i) => i.entityId);
  if (entityIds.length === 0) return { avgLevel: 'LOW', highCount: 0, localCount: 0 };

  const attractions = await prisma.attraction.findMany({
    where: { id: { in: entityIds } },
    include: {
      crowdRecords: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
  });

  const crowdRank: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };
  const reverseCrowdRank = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
  let totalRank = 0;
  let highCount = 0;

  for (const attraction of attractions) {
    const level = attraction.crowdRecords[0]?.currentCrowdLevel ?? 'LOW';
    totalRank += crowdRank[level] ?? 0;
    if (level === 'HIGH' || level === 'SEVERE') highCount++;
  }

  const avgRank = attractions.length > 0 ? Math.round(totalRank / attractions.length) : 0;
  const avgLevel = reverseCrowdRank[Math.min(avgRank, 3)];

  // Count local businesses near itinerary stops
  const destinations = [...new Set(attractions.map((a) => a.destinationId))];
  const localBusinesses = await prisma.localBusiness.findMany({
    where: { destinationId: { in: destinations }, isLocallyOwned: true },
    select: { latitude: true, longitude: true },
  });

  // Simple proximity check: local business within ~500m of any itinerary stop
  let localCount = 0;
  for (const attraction of attractions) {
    for (const biz of localBusinesses) {
      const dist = Math.sqrt(
        Math.pow(attraction.latitude - biz.latitude, 2) +
        Math.pow(attraction.longitude - biz.longitude, 2)
      );
      if (dist < 0.005) { // ~500m in degrees
        localCount++;
        break;
      }
    }
  }

  return { avgLevel, highCount, localCount };
}

// ─── POST /api/v1/scoring/tourism-impact ────────────────────────────────────

router.post('/tourism-impact', async (req, res, next) => {
  try {
    const parsed = impactSchema.parse(req.body);
    const input: PlannerInput = {
      ...parsed,
      destinationId: resolveDestinationId(parsed.destinationId),
    };

    // 1. Generate "Popular route" — baseline planner output
    const popularPlan = await generateItinerary(input);

    // 2. Generate "Responsible route" — crowd-avoidance + local-business weights
    const responsiblePlan = await generateItinerary(input, {
      strictCrowdFilter: true,
      crowdAvoidanceWeight: 3.0,
      localBusinessPreferenceWeight: 2.0,
    });

    // 3. Compute metrics from REAL data
    const popularMetrics = await countCrowdMetrics(popularPlan);
    const responsibleMetrics = await countCrowdMetrics(responsiblePlan);

    const metrics: ImpactMetrics = {
      popularRoute: {
        itemCount: popularPlan.itineraryItems.length,
        avgCrowdLevel: popularMetrics.avgLevel,
        highCrowdStops: popularMetrics.highCount,
      },
      responsibleRoute: {
        itemCount: responsiblePlan.itineraryItems.length,
        avgCrowdLevel: responsibleMetrics.avgLevel,
        highCrowdStops: responsibleMetrics.highCount,
        localBusinessStops: responsibleMetrics.localCount,
      },
      comparison: {
        crowdPressureDelta: popularMetrics.highCount > responsibleMetrics.highCount
          ? `${popularMetrics.highCount - responsibleMetrics.highCount} fewer high-crowd stops`
          : 'No crowd pressure difference',
        localBusinessDelta: responsibleMetrics.localCount - popularMetrics.localCount,
        message: responsibleMetrics.localCount > popularMetrics.localCount
          ? `The responsible route supports ${responsibleMetrics.localCount} local businesses`
          : 'Both routes have similar local business exposure',
      },
    };

    res.json({
      data: {
        popularRoute: popularPlan,
        responsibleRoute: responsiblePlan,
        metrics,
        computedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid impact score request', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

export default router;
