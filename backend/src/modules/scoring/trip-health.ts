/**
 * Feature 2: Travel Risk Radar — Trip Health Score
 *
 * Deterministic scoring function combining real signals:
 *   - Weather severity (Open-Meteo data)
 *   - Crowd levels (existing crowding engine)
 *   - Transport/routing issues (saved route buffers and fallback warnings)
 *   - Verified closures / sensitivity flags
 *   - Accessibility mismatches
 *   - Emergency readiness
 *
 * Formula: score = 100 - Σ(penalty_i)
 * See SCORING_METHODOLOGY.md for full documentation.
 *
 * The LLM NEVER invents or estimates this score.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { getWeatherForecast, type WeatherForecastDay } from '../live-data/weather.js';
import { emergencyContactBundle } from '../emergency/index.js';

const router = Router();

const tripIdParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

// ─── Scoring Weights (documented in SCORING_METHODOLOGY.md) ─────────────────
// Each weight represents the maximum penalty for that category.

const WEIGHTS = {
  WEATHER_MAX_PENALTY: 20,      // Severe weather on any trip day
  CROWD_MAX_PENALTY: 20,        // Average crowd level across itinerary stops
  TRANSPORT_MAX_PENALTY: 15,    // Long buffers, walking tolerance, fallback routes
  CLOSURES_MAX_PENALTY: 15,     // Sensitivity flags / closures affecting stops
  ACCESSIBILITY_MAX_PENALTY: 15, // Mismatches between user needs and attraction
  EMERGENCY_MAX_PENALTY: 5,     // Helpline and personal contact readiness
  DATA_QUALITY_MAX_PENALTY: 10,  // Unverified or disputed facts in itinerary
} as const;

type SubScore = {
  category: string;
  score: number; // 0-100 (100 = no issues)
  penalty: number;
  maxPenalty: number;
  factors: Array<{ description: string; source?: string; timestamp?: string }>;
};

type TripHealthResult = {
  score: number; // 0-100
  label: string;
  subScores: SubScore[];
  computedAt: string;
};

type StoredUserPreference = {
  transportPreference?: string | null;
  accessibilityMobility?: boolean | null;
  accessibilityVision?: boolean | null;
  accessibilityHearing?: boolean | null;
  accessibilityCognitive?: boolean | null;
  walkingToleranceMinutes?: number | null;
};

type HealthPreferences = {
  transportPreference: string;
  accessibilityWheelchair: boolean;
  accessibilityVision: boolean;
  accessibilityHearing: boolean;
  accessibilityCognitive: boolean;
  walkingToleranceMinutes?: number;
};

type HealthItem = {
  travelBufferMinutesBefore: number;
  trustSummary: unknown;
  attraction?: {
    name: string;
    accessibilityWheelchair: boolean;
    accessibilityVisual: boolean;
    accessibilityHearing: boolean;
    accessibilityNotes?: string | null;
  } | null;
};

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'At Risk';
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function trustWarnings(value: unknown): string[] {
  const warnings = objectValue(value)?.warnings;
  return Array.isArray(warnings) ? warnings.filter((warning): warning is string => typeof warning === 'string') : [];
}

export function healthPreferencesFrom(
  plannerInput: unknown,
  userPreference?: StoredUserPreference | null,
): HealthPreferences {
  const plannerPreferences = objectValue(objectValue(plannerInput)?.preferences);
  return {
    transportPreference: stringValue(plannerPreferences?.transportPreference, userPreference?.transportPreference ?? 'MIXED'),
    accessibilityWheelchair: booleanValue(plannerPreferences?.accessibilityWheelchair, userPreference?.accessibilityMobility ?? false),
    accessibilityVision: booleanValue(plannerPreferences?.accessibilityVision, userPreference?.accessibilityVision ?? false),
    accessibilityHearing: booleanValue(plannerPreferences?.accessibilityHearing, userPreference?.accessibilityHearing ?? false),
    accessibilityCognitive: booleanValue(plannerPreferences?.accessibilityCognitive, userPreference?.accessibilityCognitive ?? false),
    walkingToleranceMinutes: numberValue(plannerPreferences?.walkingToleranceMinutes, userPreference?.walkingToleranceMinutes ?? undefined),
  };
}

// ─── Weather Sub-Score ──────────────────────────────────────────────────────

function computeWeatherPenalty(
  forecast: WeatherForecastDay[],
  tripDays: number,
): SubScore {
  const factors: SubScore['factors'] = [];
  let penalty = 0;

  if (forecast.length === 0) {
    factors.push({ description: 'Weather forecast not available', source: 'Open-Meteo' });
    return {
      category: 'weather',
      score: 100,
      penalty: 0,
      maxPenalty: WEIGHTS.WEATHER_MAX_PENALTY,
      factors,
    };
  }

  let severeCount = 0;
  for (const day of forecast) {
    if (day.maxTemp > 42) {
      severeCount++;
      factors.push({
        description: `Extreme heat on ${day.date}: ${day.maxTemp}°C`,
        source: 'Open-Meteo',
        timestamp: new Date().toISOString(),
      });
    }
    if (['thunderstorm', 'snow'].includes(day.condition)) {
      severeCount++;
      factors.push({
        description: `${day.condition} expected on ${day.date}`,
        source: 'Open-Meteo',
        timestamp: new Date().toISOString(),
      });
    }
    if (day.condition === 'rain') {
      factors.push({
        description: `Rain expected on ${day.date}`,
        source: 'Open-Meteo',
        timestamp: new Date().toISOString(),
      });
      penalty += WEIGHTS.WEATHER_MAX_PENALTY * 0.15; // mild penalty for rain
    }
  }

  penalty += (severeCount / Math.max(1, tripDays)) * WEIGHTS.WEATHER_MAX_PENALTY;
  penalty = Math.min(penalty, WEIGHTS.WEATHER_MAX_PENALTY);

  return {
    category: 'weather',
    score: Math.round(100 - (penalty / WEIGHTS.WEATHER_MAX_PENALTY) * 100),
    penalty: Math.round(penalty),
    maxPenalty: WEIGHTS.WEATHER_MAX_PENALTY,
    factors,
  };
}

// ─── Crowd Sub-Score ────────────────────────────────────────────────────────

function computeCrowdPenalty(
  crowdLevels: Array<{ attractionName: string; level: string; timestamp: string }>,
): SubScore {
  const factors: SubScore['factors'] = [];
  const crowdRank: Record<string, number> = { LOW: 0, MODERATE: 0.3, HIGH: 0.7, SEVERE: 1.0 };

  if (crowdLevels.length === 0) {
    factors.push({ description: 'No crowd data available for itinerary stops' });
    return { category: 'crowd', score: 100, penalty: 0, maxPenalty: WEIGHTS.CROWD_MAX_PENALTY, factors };
  }

  let totalCrowdRisk = 0;
  for (const record of crowdLevels) {
    const risk = crowdRank[record.level] ?? 0;
    totalCrowdRisk += risk;
    if (risk >= 0.7) {
      factors.push({
        description: `${record.attractionName}: ${record.level} crowd level`,
        timestamp: record.timestamp,
      });
    }
  }

  const avgRisk = totalCrowdRisk / crowdLevels.length;
  const penalty = Math.round(avgRisk * WEIGHTS.CROWD_MAX_PENALTY);

  return {
    category: 'crowd',
    score: Math.round(100 - (penalty / WEIGHTS.CROWD_MAX_PENALTY) * 100),
    penalty,
    maxPenalty: WEIGHTS.CROWD_MAX_PENALTY,
    factors,
  };
}

// ─── Transport Sub-Score ───────────────────────────────────────────────────

export function computeTransportPenalty(
  items: HealthItem[],
  preferences: HealthPreferences,
): SubScore {
  const factors: SubScore['factors'] = [];

  if (items.length === 0) {
    factors.push({ description: 'No itinerary route segments saved' });
    return { category: 'transport', score: 100, penalty: 0, maxPenalty: WEIGHTS.TRANSPORT_MAX_PENALTY, factors };
  }

  let riskUnits = 0;
  for (const item of items) {
    const attractionName = item.attraction?.name ?? 'Unknown stop';
    const buffer = item.travelBufferMinutesBefore;
    const routingFallback = trustWarnings(item.trustSummary).some((warning) =>
      warning.toLowerCase().includes('routing unavailable')
    );

    if (routingFallback) {
      riskUnits += 0.8;
      factors.push({ description: `${attractionName}: route unavailable, estimated buffer used` });
    }

    if (buffer >= 90) {
      riskUnits += 1;
      factors.push({ description: `${attractionName}: long travel buffer (${buffer} min)` });
    } else if (buffer >= 60) {
      riskUnits += 0.6;
      factors.push({ description: `${attractionName}: elevated travel buffer (${buffer} min)` });
    }

    if (
      preferences.transportPreference === 'WALKING' &&
      preferences.walkingToleranceMinutes &&
      buffer > preferences.walkingToleranceMinutes
    ) {
      riskUnits += 0.6;
      factors.push({ description: `${attractionName}: walking buffer exceeds ${preferences.walkingToleranceMinutes} min tolerance` });
    }
  }

  const penalty = Math.round(Math.min(1, riskUnits / items.length) * WEIGHTS.TRANSPORT_MAX_PENALTY);
  return {
    category: 'transport',
    score: Math.round(100 - (penalty / WEIGHTS.TRANSPORT_MAX_PENALTY) * 100),
    penalty,
    maxPenalty: WEIGHTS.TRANSPORT_MAX_PENALTY,
    factors: factors.length > 0 ? factors : [{ description: 'Route buffers look manageable' }],
  };
}

// ─── Accessibility Sub-Score ───────────────────────────────────────────────

export function computeAccessibilityPenalty(
  items: HealthItem[],
  preferences: HealthPreferences,
): SubScore {
  const factors: SubScore['factors'] = [];
  const needs = [
    preferences.accessibilityWheelchair ? 'mobility' : null,
    preferences.accessibilityVision ? 'vision' : null,
    preferences.accessibilityHearing ? 'hearing' : null,
    preferences.accessibilityCognitive ? 'cognitive' : null,
  ].filter(Boolean) as string[];

  if (needs.length === 0) {
    return {
      category: 'accessibility',
      score: 100,
      penalty: 0,
      maxPenalty: WEIGHTS.ACCESSIBILITY_MAX_PENALTY,
      factors: [{ description: 'No accessibility needs recorded for this trip' }],
    };
  }

  const assessableItems = items.filter((item) => item.attraction);
  if (assessableItems.length === 0) {
    const penalty = Math.round(WEIGHTS.ACCESSIBILITY_MAX_PENALTY * 0.5);
    return {
      category: 'accessibility',
      score: Math.round(100 - (penalty / WEIGHTS.ACCESSIBILITY_MAX_PENALTY) * 100),
      penalty,
      maxPenalty: WEIGHTS.ACCESSIBILITY_MAX_PENALTY,
      factors: [{ description: 'No attraction accessibility data available for this itinerary' }],
    };
  }

  let problemUnits = 0;
  for (const item of assessableItems) {
    const attraction = item.attraction!;
    if (preferences.accessibilityWheelchair && !attraction.accessibilityWheelchair) {
      problemUnits++;
      factors.push({ description: `${attraction.name}: mobility accessibility not confirmed` });
    }
    if (preferences.accessibilityVision && !attraction.accessibilityVisual) {
      problemUnits++;
      factors.push({ description: `${attraction.name}: visual accessibility not confirmed` });
    }
    if (preferences.accessibilityHearing && !attraction.accessibilityHearing) {
      problemUnits++;
      factors.push({ description: `${attraction.name}: hearing accessibility not confirmed` });
    }
    if (preferences.accessibilityCognitive && !attraction.accessibilityNotes?.toLowerCase().includes('cognitive')) {
      problemUnits += 0.5;
      factors.push({ description: `${attraction.name}: cognitive accessibility detail not available` });
    }
  }

  const checks = assessableItems.length * needs.length;
  const penalty = Math.round(Math.min(1, problemUnits / Math.max(1, checks)) * WEIGHTS.ACCESSIBILITY_MAX_PENALTY);
  return {
    category: 'accessibility',
    score: Math.round(100 - (penalty / WEIGHTS.ACCESSIBILITY_MAX_PENALTY) * 100),
    penalty,
    maxPenalty: WEIGHTS.ACCESSIBILITY_MAX_PENALTY,
    factors: factors.length > 0 ? factors : [{ description: 'No accessibility mismatches detected' }],
  };
}

// ─── Emergency Sub-Score ───────────────────────────────────────────────────

export function computeEmergencyPenalty(
  destination: { region: string | null },
  user: { emergencyContactPhone: string | null },
): SubScore {
  const factors: SubScore['factors'] = [];
  const bundle = emergencyContactBundle(destination);
  let penalty = 0;

  if (bundle.contacts.length === 0) {
    return {
      category: 'emergency',
      score: 0,
      penalty: WEIGHTS.EMERGENCY_MAX_PENALTY,
      maxPenalty: WEIGHTS.EMERGENCY_MAX_PENALTY,
      factors: [{ description: 'No emergency contacts available for this destination' }],
    };
  }

  if (!bundle.contacts.some((contact) => contact.available24x7 && contact.category === 'emergency')) {
    penalty += 3;
    factors.push({ description: 'No 24x7 emergency helpline available' });
  }

  if (!bundle.contacts.some((contact) => contact.category === 'tourist')) {
    penalty += 1;
    factors.push({ description: 'No tourist helpline available' });
  }

  if (destination.region && bundle.regionalCount === 0) {
    penalty += 1;
    factors.push({ description: `No regional emergency contacts mapped for ${destination.region}` });
  }

  if (!user.emergencyContactPhone) {
    penalty += 1;
    factors.push({ description: 'Traveler personal emergency contact is not set' });
  }

  penalty = Math.min(penalty, WEIGHTS.EMERGENCY_MAX_PENALTY);
  return {
    category: 'emergency',
    score: Math.round(100 - (penalty / WEIGHTS.EMERGENCY_MAX_PENALTY) * 100),
    penalty,
    maxPenalty: WEIGHTS.EMERGENCY_MAX_PENALTY,
    factors: factors.length > 0 ? factors : [{ description: 'Emergency contacts and traveler contact are available' }],
  };
}

// ─── GET /api/v1/scoring/trip-health/:id ────────────────────────────────────

router.get('/trip-health/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = tripIdParamSchema.parse(req.params);

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        destination: true,
        user: {
          select: {
            emergencyContactPhone: true,
            preferences: true,
          },
        },
        itineraries: {
          include: {
            items: {
              include: {
                attraction: {
                  include: {
                    crowdRecords: { orderBy: { timestamp: 'desc' }, take: 1 },
                    sensitivityFlags: true,
                    facts: { select: { verificationStatus: true, lastChecked: true } },
                  },
                },
              },
            },
          },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!trip || trip.userId !== req.user!.userId) {
      throw new AppError('Trip not found', 404, 'NOT_FOUND');
    }

    const items = trip.itineraries[0]?.items ?? [];
    const preferences = healthPreferencesFrom(
      trip.plannerInput ?? trip.itineraries[0]?.plannerInput ?? objectValue(trip.itinerarySnapshot)?.plannerInput,
      trip.user.preferences,
    );
    const tripDays = Math.max(1, Math.ceil(
      (trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ));

    // 1. Weather sub-score
    let weatherSubScore: SubScore;
    try {
      const forecast = await getWeatherForecast(
        trip.destination.latitude,
        trip.destination.longitude,
        trip.startDate.toISOString().split('T')[0],
        trip.endDate.toISOString().split('T')[0],
      );
      weatherSubScore = computeWeatherPenalty(forecast, tripDays);
    } catch {
      weatherSubScore = {
        category: 'weather',
        score: 100,
        penalty: 0,
        maxPenalty: WEIGHTS.WEATHER_MAX_PENALTY,
        factors: [{ description: 'Weather data unavailable' }],
      };
    }

    // 2. Crowd sub-score
    const crowdLevels = items
      .filter((item) => item.attraction?.crowdRecords[0])
      .map((item) => ({
        attractionName: item.attraction?.name ?? 'Unknown',
        level: item.attraction!.crowdRecords[0].currentCrowdLevel,
        timestamp: item.attraction!.crowdRecords[0].timestamp.toISOString(),
      }));
    const crowdSubScore = computeCrowdPenalty(crowdLevels);

    // 3. Transport sub-score
    const transportSubScore = computeTransportPenalty(items, preferences);

    // 4. Closures sub-score
    const closureFactors: SubScore['factors'] = [];
    let closurePenalty = 0;
    for (const item of items) {
      const flags = item.attraction?.sensitivityFlags ?? [];
      for (const flag of flags) {
        const isActive = (!flag.activeFrom || flag.activeFrom <= trip.startDate) &&
          (!flag.activeTo || flag.activeTo >= trip.startDate);
        if (isActive) {
          closurePenalty += WEIGHTS.CLOSURES_MAX_PENALTY / Math.max(1, items.length);
          closureFactors.push({
            description: `${item.attraction?.name}: ${flag.description || flag.sensitivityType}`,
          });
        }
      }
    }
    closurePenalty = Math.min(closurePenalty, WEIGHTS.CLOSURES_MAX_PENALTY);
    const closureSubScore: SubScore = {
      category: 'closures',
      score: Math.round(100 - (closurePenalty / WEIGHTS.CLOSURES_MAX_PENALTY) * 100),
      penalty: Math.round(closurePenalty),
      maxPenalty: WEIGHTS.CLOSURES_MAX_PENALTY,
      factors: closureFactors.length > 0 ? closureFactors : [{ description: 'No active closures or restrictions' }],
    };

    // 5. Accessibility sub-score
    const accessibilitySubScore = computeAccessibilityPenalty(items, preferences);

    // 6. Emergency readiness sub-score
    const emergencySubScore = computeEmergencyPenalty(trip.destination, {
      emergencyContactPhone: trip.user.emergencyContactPhone,
    });

    // 7. Data quality sub-score
    let totalFacts = 0;
    let unverifiedFacts = 0;
    const dataFactors: SubScore['factors'] = [];
    for (const item of items) {
      const facts = item.attraction?.facts ?? [];
      totalFacts += facts.length;
      for (const fact of facts) {
        if (['UNVERIFIED', 'DISPUTED', 'OUTDATED'].includes(fact.verificationStatus)) {
          unverifiedFacts++;
        }
      }
    }
    const dataRatio = totalFacts > 0 ? unverifiedFacts / totalFacts : 0;
    const dataPenalty = Math.round(dataRatio * WEIGHTS.DATA_QUALITY_MAX_PENALTY);
    if (unverifiedFacts > 0) {
      dataFactors.push({ description: `${unverifiedFacts} of ${totalFacts} facts are unverified/disputed/outdated` });
    } else {
      dataFactors.push({ description: `All ${totalFacts} facts are verified or live` });
    }
    const dataSubScore: SubScore = {
      category: 'data_quality',
      score: Math.round(100 - (dataPenalty / WEIGHTS.DATA_QUALITY_MAX_PENALTY) * 100),
      penalty: dataPenalty,
      maxPenalty: WEIGHTS.DATA_QUALITY_MAX_PENALTY,
      factors: dataFactors,
    };

    // ─── Aggregate ──────────────────────────────────────────────────────────
    const subScores = [
      weatherSubScore,
      crowdSubScore,
      transportSubScore,
      closureSubScore,
      accessibilitySubScore,
      emergencySubScore,
      dataSubScore,
    ];
    const totalPenalty = subScores.reduce((sum, s) => sum + s.penalty, 0);
    const score = Math.max(0, Math.min(100, 100 - totalPenalty));

    const result: TripHealthResult = {
      score,
      label: scoreLabel(score),
      subScores,
      computedAt: new Date().toISOString(),
    };

    res.json({ data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid trip ID', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

export default router;
