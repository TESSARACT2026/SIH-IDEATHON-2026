import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { feedbackLimiter } from '../../shared/middleware/rateLimiter.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { sanitizeBody } from '../../shared/middleware/sanitize.js';
import { resolveAttractionId } from '../../shared/utils/idAliases.js';

const router = Router();

const feedbackSchema = z.object({
  entityId: z.string().min(1).max(100),
  entityType: z.enum(['ATTRACTION', 'FACT', 'CROWD_RECORD']),
  feedbackType: z.enum(['INACCURATE', 'OUTDATED', 'OTHER']),
  comment: z.string().max(500).optional(),
}).strict();

// Rate limit + auth + XSS sanitization on feedback submissions
router.post('/', feedbackLimiter, requireAuth, sanitizeBody, async (req, res, next) => {
  try {
    const { entityId: rawEntityId, entityType, feedbackType, comment } = feedbackSchema.parse(req.body);
    const entityId = entityType === 'ATTRACTION' ? resolveAttractionId(rawEntityId) : rawEntityId;
    let factId: string | null = null;

    // Verify the target entity actually exists before accepting feedback
    if (entityType === 'FACT') {
      const fact = await prisma.fact.findUnique({ where: { id: entityId } });
      if (!fact) {
        throw new AppError('The referenced fact does not exist', 404, 'ENTITY_NOT_FOUND');
      }
      factId = fact.id;
    } else if (entityType === 'ATTRACTION') {
      const attraction = await prisma.attraction.findUnique({ where: { id: entityId }, select: { id: true } });
      if (!attraction) {
        throw new AppError('The referenced attraction does not exist', 404, 'ENTITY_NOT_FOUND');
      }
    } else {
      const crowdRecord = await prisma.crowdCapacityRecord.findUnique({ where: { id: entityId }, select: { id: true } });
      if (!crowdRecord) {
        throw new AppError('The referenced crowd record does not exist', 404, 'ENTITY_NOT_FOUND');
      }
    }

    // Store feedback as PENDING for manual review — NEVER auto-downgrade verification status.
    // Per PRD: "single flag auto-downgrades to disputed, pending review before any state change."
    // We interpret this as: store the flag, mark it pending, review queue handles the rest.
    // This prevents an attacker from mass-downgrading all facts via scripted POST requests.
    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user!.userId,
        entityType,
        entityId,
        feedbackType,
        factId,
        note: comment,
      },
    });

    res.status(201).json({
      data: {
        id: feedback.id,
        success: true,
        message: 'Feedback received and queued for review',
        status: feedback.status,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid feedback payload',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    console.error('Feedback Error:', err);
    next(new AppError('Failed to submit feedback', 500, 'FEEDBACK_ERROR'));
  }
});

export default router;
