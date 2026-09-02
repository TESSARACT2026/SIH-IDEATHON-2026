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
import {
  generateItinerary,
  localBusinessProximityScore,
  type PlannerInput,
  type PlanResult,
} from '../planner/engine.js';

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
    localBusinessPreference: z.boolean().default(false).optional(),
  }).strict(),
}).strict();

type ImpactLevel = 'Low' | 'Medium' | 'High';

type ImpactMetrics = {
  popularRoute: {
    itemCount: number;
    avgCrowdLevel: string;
    highCrowdStops: number;
    localBusinessStops: number;
    travelDistanceKm: number;
    environmentalSensitivityFlags: number;
    culturalSensitivityFlags: number;
    environmentalImpact: ImpactLevel;
    culturalSensitivity: ImpactLevel;
    impactScore: number;
  };
  responsibleRoute: {
    itemCount: number;
    avgCrowdLevel: string;
    highCrowdStops: number;
    localBusinessStops: number;
    travelDistanceKm: number;
    environmentalSensitivityFlags: number;
    culturalSensitivityFlags: number;
    environmentalImpact: ImpactLevel;
    culturalSensitivity: ImpactLevel;
    impactScore: number;
  };
  comparison: {
    crowdPressureDelta: string;
    localBusinessDelta: number;
    travelDistanceDeltaKm: number;
    environmentalSensitivityDelta: number;
    culturalSensitivityDelta: number;
    impactScoreDelta: number;
    message: string;
  };
};

type ImpactScoreInput = {
  itemCount: number;
  highCrowdStops: number;
  localBusinessStops: number;
  travelDistanceKm: number;
  environmentalSensitivityFlags: number;
  culturalSensitivityFlags: number;
};

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function impactLevel(penalty: number): ImpactLevel {
  if (penalty <= 8) return 'Low';
  if (penalty <= 18) return 'Medium';
  return 'High';
}

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function planTravelDistanceKm(
  plan: Pick<PlanResult, 'itineraryItems'>,
  attractionById: Map<string, { latitude: number; longitude: number }>,
) {
  let total = 0;
  let last: { latitude: number; longitude: number } | null = null;

  for (const item of plan.itineraryItems) {
    const current = attractionById.get(item.entityId);
    if (!current) continue;
    if (last) total += distanceKm(last, current);
    last = current;
  }

  return rounded(total);
}

export function tourismImpactSummary(input: ImpactScoreInput) {
  const crowdPenalty = input.itemCount > 0 ? (input.highCrowdStops / input.itemCount) * 35 : 0;
  const travelPenalty = Math.min(25, input.travelDistanceKm * 0.8);
  const environmentalFlagPenalty = Math.min(20, input.environmentalSensitivityFlags * 10);
  const culturalPenalty = Math.min(15, input.culturalSensitivityFlags * 7.5);
  const localBonus = input.itemCount > 0 ? Math.min(15, (input.localBusinessStops / input.itemCount) * 15) : 0;

  return {
    impactScore: Math.max(0, Math.min(100, Math.round(100 - crowdPenalty - travelPenalty - environmentalFlagPenalty - culturalPenalty + localBonus))),
    environmentalImpact: impactLevel(travelPenalty + environmentalFlagPenalty),
    culturalSensitivity: impactLevel(culturalPenalty),
  };
}

// Count impact signals from itinerary items by looking up the attractions
async function countImpactMetrics(plan: PlanResult, tripStart: Date) {
  const entityIds = plan.itineraryItems.map((i) => i.entityId);
  if (entityIds.length === 0) {
    return {
      avgLevel: 'LOW',
      highCount: 0,
      localCount: 0,
      travelDistanceKm: 0,
      environmentalSensitivityFlags: 0,
      culturalSensitivityFlags: 0,
      environmentalImpact: 'Low' as ImpactLevel,
      culturalSensitivity: 'Low' as ImpactLevel,
      impactScore: 100,
    };
  }

  const attractions = await prisma.attraction.findMany({
    where: { id: { in: entityIds } },
    include: {
      crowdRecords: { orderBy: { timestamp: 'desc' }, take: 1 },
      sensitivityFlags: true,
    },
  });
  const attractionById = new Map(attractions.map((attraction) => [attraction.id, attraction]));

  const crowdRank: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };
  const reverseCrowdRank = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
  let totalRank = 0;
  let highCount = 0;
  let environmentalSensitivityFlags = 0;
  let culturalSensitivityFlags = 0;

  for (const attraction of attractions) {
    const level = attraction.crowdRecords[0]?.currentCrowdLevel ?? 'LOW';
    totalRank += crowdRank[level] ?? 0;
    if (level === 'HIGH' || level === 'SEVERE') highCount++;

    for (const flag of attraction.sensitivityFlags) {
      const active = (!flag.activeFrom || flag.activeFrom <= tripStart) &&
        (!flag.activeTo || flag.activeTo >= tripStart);
      if (!active) continue;
      if (flag.sensitivityType === 'ENVIRONMENTAL') environmentalSensitivityFlags++;
      if (flag.sensitivityType === 'CULTURAL' || flag.sensitivityType === 'COMMUNITY_RESTRICTION') culturalSensitivityFlags++;
    }
  }

  const avgRank = attractions.length > 0 ? Math.round(totalRank / attractions.length) : 0;
  const avgLevel = reverseCrowdRank[Math.min(avgRank, 3)];

  // Count local businesses near itinerary stops
  const destinations = [...new Set(attractions.map((a) => a.destinationId))];
  const localBusinesses = await prisma.localBusiness.findMany({
    where: { destinationId: { in: destinations }, isLocallyOwned: true },
    select: { latitude: true, longitude: true },
  });

  const localCount = attractions.filter((attraction) =>
    localBusinessProximityScore(attraction, localBusinesses) > 0
  ).length;
  const travelDistanceKm = planTravelDistanceKm(plan, attractionById);
  const summary = tourismImpactSummary({
    itemCount: plan.itineraryItems.length,
    highCrowdStops: highCount,
    localBusinessStops: localCount,
    travelDistanceKm,
    environmentalSensitivityFlags,
    culturalSensitivityFlags,
  });

  return {
    avgLevel,
    highCount,
    localCount,
    travelDistanceKm,
    environmentalSensitivityFlags,
    culturalSensitivityFlags,
    ...summary,
  };
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
    const tripStart = new Date(input.startDate);
    const popularMetrics = await countImpactMetrics(popularPlan, tripStart);
    const responsibleMetrics = await countImpactMetrics(responsiblePlan, tripStart);

    const metrics: ImpactMetrics = {
      popularRoute: {
        itemCount: popularPlan.itineraryItems.length,
        avgCrowdLevel: popularMetrics.avgLevel,
        highCrowdStops: popularMetrics.highCount,
        localBusinessStops: popularMetrics.localCount,
        travelDistanceKm: popularMetrics.travelDistanceKm,
        environmentalSensitivityFlags: popularMetrics.environmentalSensitivityFlags,
        culturalSensitivityFlags: popularMetrics.culturalSensitivityFlags,
        environmentalImpact: popularMetrics.environmentalImpact,
        culturalSensitivity: popularMetrics.culturalSensitivity,
        impactScore: popularMetrics.impactScore,
      },
      responsibleRoute: {
        itemCount: responsiblePlan.itineraryItems.length,
        avgCrowdLevel: responsibleMetrics.avgLevel,
        highCrowdStops: responsibleMetrics.highCount,
        localBusinessStops: responsibleMetrics.localCount,
        travelDistanceKm: responsibleMetrics.travelDistanceKm,
        environmentalSensitivityFlags: responsibleMetrics.environmentalSensitivityFlags,
        culturalSensitivityFlags: responsibleMetrics.culturalSensitivityFlags,
        environmentalImpact: responsibleMetrics.environmentalImpact,
        culturalSensitivity: responsibleMetrics.culturalSensitivity,
        impactScore: responsibleMetrics.impactScore,
      },
      comparison: {
        crowdPressureDelta: popularMetrics.highCount > responsibleMetrics.highCount
          ? `${popularMetrics.highCount - responsibleMetrics.highCount} fewer high-crowd stops`
          : 'No crowd pressure difference',
        localBusinessDelta: responsibleMetrics.localCount - popularMetrics.localCount,
        travelDistanceDeltaKm: rounded(popularMetrics.travelDistanceKm - responsibleMetrics.travelDistanceKm),
        environmentalSensitivityDelta: popularMetrics.environmentalSensitivityFlags - responsibleMetrics.environmentalSensitivityFlags,
        culturalSensitivityDelta: popularMetrics.culturalSensitivityFlags - responsibleMetrics.culturalSensitivityFlags,
        impactScoreDelta: responsibleMetrics.impactScore - popularMetrics.impactScore,
        message: responsibleMetrics.impactScore > popularMetrics.impactScore
          ? `Responsible route improves impact score by ${responsibleMetrics.impactScore - popularMetrics.impactScore} points`
          : 'Both routes have similar tourism impact',
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
