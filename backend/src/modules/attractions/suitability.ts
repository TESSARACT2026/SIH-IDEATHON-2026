/**
 * Feature 3: "Why NOT This Place?" Explainability
 *
 * Runs the SAME deterministic feasibility checks the planner uses
 * (opening hours, weather, walking/accessibility fit, crowd level)
 * against a specific attraction + time slot, and returns a structured
 * verdict. This is NOT a separate LLM judgment call.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { resolveAttractionId } from '../../shared/utils/idAliases.js';
import {
  exclusionFor,
  minutesToTime,
  openingWindow,
  timeToMinutes,
  VISIT_DURATION_MINUTES,
  type PlannerAttraction,
} from '../planner/engine.js';
import { getLiveWeather, getWeatherForecast } from '../live-data/weather.js';

const router = Router();

const queryBoolean = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}, z.boolean().default(false));

const optionalQueryNumber = (schema: z.ZodNumber) => z.preprocess((value) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, schema.optional());

const suitabilityQuerySchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  date: z.string().datetime().optional(),
  accessibilityWheelchair: queryBoolean,
  accessibilityVision: queryBoolean,
  accessibilityHearing: queryBoolean,
  accessibilityCognitive: queryBoolean,
  walkingToleranceMinutes: optionalQueryNumber(z.number().int().min(5).max(240)),
  weatherCondition: z.enum(['clear', 'cloudy', 'rain', 'snow', 'thunderstorm', 'extreme_heat', 'unknown']).optional(),
  maxTempC: optionalQueryNumber(z.number().min(-30).max(60)),
}).strict();

const idParamSchema = z.object({
  id: z.string().min(1).max(100),
}).strict();

type SuitabilityReason = {
  check: string;
  passed: boolean;
  detail: string;
};

type SuitabilityQuery = z.infer<typeof suitabilityQuerySchema>;

export type SuitabilityWeather = {
  condition: string;
  temperatureC?: number;
  source?: string;
  unavailable?: boolean;
};

type SuitabilityAttraction = Pick<
  PlannerAttraction,
  | 'id'
  | 'name'
  | 'destinationId'
  | 'categories'
  | 'latitude'
  | 'longitude'
  | 'indoorOutdoor'
  | 'accessibilityWheelchair'
  | 'accessibilityVisual'
  | 'accessibilityHearing'
  | 'accessibilityNotes'
  | 'facts'
  | 'crowdRecords'
  | 'sensitivityFlags'
>;

function formatTime(minutes: number) {
  return minutesToTime(minutes);
}

export function estimateWalkingMinutes(attraction: Pick<SuitabilityAttraction, 'indoorOutdoor' | 'categories' | 'accessibilityNotes'>) {
  let minutes = attraction.indoorOutdoor === 'indoor' ? 15 : attraction.indoorOutdoor === 'mixed' ? 25 : 40;
  const categories = attraction.categories.map((category) => category.toLowerCase());
  const notes = attraction.accessibilityNotes?.toLowerCase() ?? '';

  if (categories.some((category) => category.includes('nature') || category.includes('park') || category.includes('fort'))) minutes += 10;
  if (categories.some((category) => category.includes('market') || category.includes('village'))) minutes += 5;
  if (/(steps|steep|uneven|walk|ghat)/.test(notes)) minutes += 15;

  return minutes;
}

export function weatherSuitabilityReason(
  attraction: Pick<SuitabilityAttraction, 'indoorOutdoor'>,
  query: Pick<SuitabilityQuery, 'time'>,
  weather: SuitabilityWeather,
): SuitabilityReason {
  if (weather.unavailable) {
    return { check: 'weather', passed: true, detail: 'Weather data unavailable; no weather block applied' };
  }

  const requestedMinutes = timeToMinutes(query.time);
  const condition = weather.condition;
  const temperature = weather.temperatureC;
  const badCondition = ['rain', 'snow', 'thunderstorm', 'extreme_heat'].includes(condition) || (temperature ?? 0) >= 40;
  const afternoonHeat = (temperature ?? 0) >= 36 && requestedMinutes >= timeToMinutes('12:00') && requestedMinutes <= timeToMinutes('16:00');
  const riskyOutdoorWeather = badCondition || afternoonHeat;
  const weatherLabel = temperature !== undefined ? `${condition}, ${temperature}C` : condition;

  if (!riskyOutdoorWeather) {
    return { check: 'weather', passed: true, detail: `Weather looks compatible (${weatherLabel})` };
  }

  if (attraction.indoorOutdoor === 'outdoor') {
    return {
      check: 'weather',
      passed: false,
      detail: `Not recommended for ${query.time}: ${weatherLabel} conflicts with outdoor exposure`,
    };
  }

  return {
    check: 'weather',
    passed: true,
    detail: `${attraction.indoorOutdoor === 'indoor' ? 'Indoor' : 'Partly indoor'} stop remains suitable in ${weatherLabel}`,
  };
}

export function walkingSuitabilityReason(
  attraction: Pick<SuitabilityAttraction, 'indoorOutdoor' | 'categories' | 'accessibilityNotes'>,
  walkingToleranceMinutes?: number,
): SuitabilityReason {
  const estimatedMinutes = estimateWalkingMinutes(attraction);
  if (walkingToleranceMinutes === undefined) {
    return {
      check: 'walking_tolerance',
      passed: true,
      detail: `Estimated walking/standing time: ${estimatedMinutes} min`,
    };
  }

  const passed = estimatedMinutes <= walkingToleranceMinutes;
  return {
    check: 'walking_tolerance',
    passed,
    detail: passed
      ? `Estimated walking/standing time ${estimatedMinutes} min fits ${walkingToleranceMinutes} min tolerance`
      : `Not recommended: estimated walking/standing time ${estimatedMinutes} min exceeds ${walkingToleranceMinutes} min tolerance`,
  };
}

async function weatherForQuery(attraction: SuitabilityAttraction, query: SuitabilityQuery): Promise<SuitabilityWeather> {
  if (query.weatherCondition || query.maxTempC !== undefined) {
    return {
      condition: query.weatherCondition ?? 'unknown',
      temperatureC: query.maxTempC,
      source: 'query',
    };
  }

  try {
    if (query.date) {
      const date = query.date.slice(0, 10);
      const forecast = await getWeatherForecast(attraction.latitude, attraction.longitude, date, date);
      const day = forecast[0];
      if (!day) return { condition: 'unknown', source: 'Open-Meteo', unavailable: true };
      return { condition: day.condition, temperatureC: day.maxTemp, source: 'Open-Meteo' };
    }

    const current = await getLiveWeather(attraction.latitude, attraction.longitude);
    return { condition: current.condition, temperatureC: current.temperature_celsius, source: current.source };
  } catch {
    return { condition: 'unknown', unavailable: true };
  }
}

function accessibilityReasons(attraction: SuitabilityAttraction, query: SuitabilityQuery): SuitabilityReason[] {
  const checks: Array<[boolean, boolean, string, string]> = [
    [query.accessibilityWheelchair, attraction.accessibilityWheelchair, 'accessibility_wheelchair', 'Wheelchair access'],
    [query.accessibilityVision, attraction.accessibilityVisual, 'accessibility_vision', 'Visual accessibility'],
    [query.accessibilityHearing, attraction.accessibilityHearing, 'accessibility_hearing', 'Hearing accessibility'],
    [
      query.accessibilityCognitive,
      Boolean(attraction.accessibilityNotes?.toLowerCase().includes('cognitive')),
      'accessibility_cognitive',
      'Cognitive accessibility',
    ],
  ];

  return checks
    .filter(([requested]) => requested)
    .map(([, passed, check, label]) => ({
      check,
      passed,
      detail: passed ? `${label} confirmed` : `${label} not confirmed`,
    }));
}

function evaluateSuitability(
  attraction: SuitabilityAttraction,
  query: SuitabilityQuery,
  weather: SuitabilityWeather,
) {
  const reasons: SuitabilityReason[] = [];
  let recommended = true;
  const requestedMinutes = timeToMinutes(query.time);

  // 1. Opening hours check - uses the SAME function as the planner
  const hoursWarnings: string[] = [];
  const hours = openingWindow(attraction as PlannerAttraction, hoursWarnings);
  if (hours) {
    const fitsInHours = requestedMinutes >= hours.open &&
      requestedMinutes + VISIT_DURATION_MINUTES <= hours.close;
    reasons.push({
      check: 'opening_hours',
      passed: fitsInHours,
      detail: fitsInHours
        ? `Open during requested time (${query.time})`
        : `Not open at ${query.time}. Hours: ${formatTime(hours.open)} - ${formatTime(hours.close)}`,
    });
    if (!fitsInHours) recommended = false;
  } else {
    reasons.push({
      check: 'opening_hours',
      passed: true,
      detail: hoursWarnings[0] ?? 'Opening hours not verified; visit may be possible',
    });
  }

  // 2. Crowd/sensitivity check - uses the SAME logic as exclusionFor()
  const tripDate = query.date ? new Date(query.date) : new Date();
  const exclusion = exclusionFor(attraction as PlannerAttraction, tripDate);
  if (exclusion) {
    reasons.push({
      check: 'crowd_or_sensitivity',
      passed: false,
      detail: exclusion.reason,
    });
    recommended = false;
  } else {
    const crowdLevel = attraction.crowdRecords[0]?.currentCrowdLevel ?? 'LOW';
    reasons.push({
      check: 'crowd_level',
      passed: true,
      detail: `Current crowd level: ${crowdLevel}`,
    });
  }

  const weatherReason = weatherSuitabilityReason(attraction, query, weather);
  reasons.push(weatherReason);
  if (!weatherReason.passed) recommended = false;

  const walkingReason = walkingSuitabilityReason(attraction, query.walkingToleranceMinutes);
  reasons.push(walkingReason);
  if (!walkingReason.passed) recommended = false;

  for (const reason of accessibilityReasons(attraction, query)) {
    reasons.push(reason);
    if (!reason.passed) recommended = false;
  }

  reasons.push({
    check: 'indoor_outdoor',
    passed: true,
    detail: `This is an ${attraction.indoorOutdoor} attraction`,
  });

  return { recommended, reasons };
}

router.get('/:id/suitability', async (req, res, next) => {
  try {
    const { id: rawId } = idParamSchema.parse(req.params);
    const id = resolveAttractionId(rawId);
    const query = suitabilityQuerySchema.parse(req.query);

    const attraction = await prisma.attraction.findUnique({
      where: { id },
      include: {
        destination: true,
        facts: {
          include: {
            source: {
              select: {
                name: true,
                sourceType: true,
              },
            },
          },
        },
        crowdRecords: { orderBy: { timestamp: 'desc' }, take: 1 },
        sensitivityFlags: true,
      },
    }) as PlannerAttraction | null;

    if (!attraction) {
      throw new AppError('Attraction not found', 404, 'NOT_FOUND');
    }

    const weather = await weatherForQuery(attraction, query);
    const { recommended, reasons } = evaluateSuitability(attraction, query, weather);

    // 5. Get alternatives if not recommended - uses the same suitability checks
    let alternatives: Array<{ id: string; name: string; categories: string[] }> = [];
    if (!recommended) {
      const candidates = await prisma.attraction.findMany({
        where: {
          destinationId: attraction.destinationId,
          id: { not: id },
        },
        include: {
          destination: true,
          facts: {
            include: {
              source: {
                select: {
                  name: true,
                  sourceType: true,
                },
              },
            },
          },
          crowdRecords: { orderBy: { timestamp: 'desc' }, take: 1 },
          sensitivityFlags: true,
        },
      }) as PlannerAttraction[];

      alternatives = candidates
        .map((c) => ({
          ...c,
          overlap: c.categories.filter((cat) => attraction.categories.includes(cat)).length,
          suitable: evaluateSuitability(c, query, weather).recommended,
        }))
        .filter((c) => c.suitable)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 3)
        .map(({ overlap: _o, suitable: _s, ...rest }) => ({
          id: rest.id,
          name: rest.name,
          categories: rest.categories,
        }));
    }

    res.json({
      data: {
        attractionId: id,
        attractionName: attraction.name,
        requestedTime: query.time,
        recommended,
        reasons,
        alternatives,
        weather,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid suitability query', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

export default router;
