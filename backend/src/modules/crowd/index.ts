import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { feedbackLimiter } from '../../shared/middleware/rateLimiter.js';
import { resolveAttractionId } from '../../shared/utils/idAliases.js';

const router = Router();

const attractionParamSchema = z.object({
  attractionId: z.string().min(1).max(100),
}).strict();

const crowdReportSchema = z.object({
  attractionId: z.string().min(1).max(100),
  currentCrowdLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'SEVERE']),
  capacityValue: z.number().int().min(0).max(100000).optional(),
}).strict();

type CrowdRecordWithSource = Prisma.CrowdCapacityRecordGetPayload<{ include: { source: true } }>;

function toCrowdResponse(record: CrowdRecordWithSource) {
  return {
    id: record.id,
    attractionId: record.attractionId,
    currentCrowdLevel: record.currentCrowdLevel,
    capacityValue: record.capacityValue,
    verificationStatus: record.verificationStatus,
    timestamp: record.timestamp.toISOString(),
    source: record.source
      ? {
          id: record.source.id,
          name: record.source.name,
          sourceType: record.source.sourceType,
        }
      : null,
  };
}

router.get('/attractions/:attractionId', async (req, res, next) => {
  try {
    const { attractionId: rawAttractionId } = attractionParamSchema.parse(req.params);
    const attractionId = resolveAttractionId(rawAttractionId);

    const attraction = await prisma.attraction.findUnique({
      where: { id: attractionId },
      select: { id: true, name: true },
    });

    if (!attraction) {
      throw new AppError('Attraction not found', 404, 'ATTRACTION_NOT_FOUND');
    }

    const latest = await prisma.crowdCapacityRecord.findFirst({
      where: { attractionId },
      include: { source: true },
      orderBy: { timestamp: 'desc' },
    });

    res.json({
      data: {
        attractionId,
        attraction,
        latest: latest ? toCrowdResponse(latest) : null,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid crowd lookup',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    next(err);
  }
});

router.post('/reports', feedbackLimiter, requireAuth, async (req, res, next) => {
  try {
    const payload = crowdReportSchema.parse(req.body);
    const attractionId = resolveAttractionId(payload.attractionId);

    const attraction = await prisma.attraction.findUnique({
      where: { id: attractionId },
      select: { id: true },
    });

    if (!attraction) {
      throw new AppError('Attraction not found', 404, 'ATTRACTION_NOT_FOUND');
    }

    const record = await prisma.crowdCapacityRecord.create({
      data: {
        attractionId,
        currentCrowdLevel: payload.currentCrowdLevel,
        capacityValue: payload.capacityValue,
        verificationStatus: 'COMMUNITY',
      },
      include: { source: true },
    });

    res.status(201).json({ data: toCrowdResponse(record) });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid crowd report',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    next(err);
  }
});

export default router;
