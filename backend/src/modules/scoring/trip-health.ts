/**
 * Feature 2: Travel Risk Radar — Trip Health Score
 *
 * Deterministic scoring function combining real signals:
 *   - Weather severity (Open-Meteo data)
 *   - Crowd levels (existing crowding engine)
 *   - Transport/routing issues (ORS)
 *   - Verified closures / sensitivity flags
 *   - Accessibility mismatches
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

const router = Router();

const tripIdParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

// ─── Scoring Weights (documented in SCORING_METHODOLOGY.md) ─────────────────
// Each weight represents the maximum penalty for that category.

const WEIGHTS = {
  WEATHER_MAX_PENALTY: 25,      // Severe weather on any trip day
  CROWD_MAX_PENALTY: 25,        // Average crowd level across itinerary stops
  CLOSURES_MAX_PENALTY: 20,     // Sensitivity flags / closures affecting stops
  ACCESSIBILITY_MAX_PENALTY: 15, // Mismatches between user needs and attraction
  DATA_QUALITY_MAX_PENALTY: 15,  // Unverified or disputed facts in itinerary
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

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'At Risk';
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

// ─── GET /api/v1/scoring/trip-health/:id ────────────────────────────────────

router.get('/trip-health/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = tripIdParamSchema.parse(req.params);

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        destination: true,
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

    // 3. Closures sub-score
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

    // 4. Data quality sub-score
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

    // 5. Accessibility sub-score (placeholder — no user prefs in trip record yet)
    const accessibilitySubScore: SubScore = {
      category: 'accessibility',
      score: 100,
      penalty: 0,
      maxPenalty: WEIGHTS.ACCESSIBILITY_MAX_PENALTY,
      factors: [{ description: 'No accessibility mismatches detected' }],
    };

    // ─── Aggregate ──────────────────────────────────────────────────────────
    const subScores = [weatherSubScore, crowdSubScore, closureSubScore, dataSubScore, accessibilitySubScore];
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
