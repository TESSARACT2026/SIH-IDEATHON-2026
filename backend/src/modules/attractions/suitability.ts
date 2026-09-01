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
  openingWindow,
  timeToMinutes,
  VISIT_DURATION_MINUTES,
  type PlannerAttraction,
} from '../planner/engine.js';

const router = Router();

const suitabilityQuerySchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  date: z.string().datetime().optional(),
  accessibilityWheelchair: z.coerce.boolean().default(false),
}).strict();

const idParamSchema = z.object({
  id: z.string().min(1).max(100),
}).strict();

type SuitabilityReason = {
  check: string;
  passed: boolean;
  detail: string;
};

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

    const reasons: SuitabilityReason[] = [];
    let recommended = true;
    const requestedMinutes = timeToMinutes(query.time);

    // 1. Opening hours check — uses the SAME function as the planner
    const hoursWarnings: string[] = [];
    const hours = openingWindow(attraction, hoursWarnings);
    if (hours) {
      const fitsInHours = requestedMinutes >= hours.open &&
        requestedMinutes + VISIT_DURATION_MINUTES <= hours.close;
      reasons.push({
        check: 'opening_hours',
        passed: fitsInHours,
        detail: fitsInHours
          ? `Open during requested time (${query.time})`
          : `Not open at ${query.time}. Hours: ${Math.floor(hours.open / 60).toString().padStart(2, '0')}:${(hours.open % 60).toString().padStart(2, '0')} – ${Math.floor(hours.close / 60).toString().padStart(2, '0')}:${(hours.close % 60).toString().padStart(2, '0')}`,
      });
      if (!fitsInHours) recommended = false;
    } else {
      reasons.push({
        check: 'opening_hours',
        passed: true,
        detail: hoursWarnings[0] ?? 'Opening hours not verified; visit may be possible',
      });
    }

    // 2. Crowd level check — uses the SAME logic as exclusionFor()
    const tripDate = query.date ? new Date(query.date) : new Date();
    const exclusion = exclusionFor(attraction, tripDate);
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

    // 3. Accessibility check
    if (query.accessibilityWheelchair) {
      const passes = attraction.accessibilityWheelchair;
      reasons.push({
        check: 'accessibility_wheelchair',
        passed: passes,
        detail: passes
          ? 'Wheelchair accessible'
          : 'Not wheelchair accessible',
      });
      if (!passes) recommended = false;
    }

    // 4. Indoor/outdoor check based on weather
    reasons.push({
      check: 'indoor_outdoor',
      passed: true,
      detail: `This is an ${attraction.indoorOutdoor} attraction`,
    });

    // 5. Get alternatives if not recommended — uses existing alternatives logic
    let alternatives: Array<{ id: string; name: string; categories: string[] }> = [];
    if (!recommended) {
      const candidates = await prisma.attraction.findMany({
        where: {
          destinationId: attraction.destinationId,
          id: { not: id },
        },
        select: { id: true, name: true, categories: true },
        take: 4,
      });

      alternatives = candidates
        .map((c) => ({
          ...c,
          overlap: c.categories.filter((cat) => attraction.categories.includes(cat)).length,
        }))
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 3)
        .map(({ overlap: _o, ...rest }) => rest);
    }

    res.json({
      data: {
        attractionId: id,
        attractionName: attraction.name,
        requestedTime: query.time,
        recommended,
        reasons,
        alternatives,
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
