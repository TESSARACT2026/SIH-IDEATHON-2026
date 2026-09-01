import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { feedbackLimiter } from '../../shared/middleware/rateLimiter.js';
import { requireAdmin, requireAuth } from '../../shared/middleware/auth.js';
import { sanitizeBody } from '../../shared/middleware/sanitize.js';
import { resolveAttractionId } from '../../shared/utils/idAliases.js';

const router = Router();

// Feature 5: Structured report types for Community Verification Network
const reportTypeEnum = z.enum([
  'CLOSED', 'PRICE_CHANGED', 'ACCESSIBILITY_INCORRECT', 'HOURS_INCORRECT',
  'ROAD_BLOCKED', 'OVERCROWDED', 'FACILITY_UNAVAILABLE', 'OTHER',
]);

const feedbackSchema = z.object({
  entityId: z.string().min(1).max(100),
  entityType: z.enum(['ATTRACTION', 'FACT', 'CROWD_RECORD']),
  feedbackType: z.enum(['INACCURATE', 'OUTDATED', 'OTHER']),
  reportType: reportTypeEnum.optional(),
  comment: z.string().max(500).optional(),
}).strict();

const reviewQueueQuerySchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED']).default('PENDING'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

const feedbackReviewSchema = z.object({
  status: z.enum(['REVIEWED', 'ACCEPTED', 'REJECTED']),
  factVerificationStatus: z.enum(['VERIFIED', 'LIVE', 'COMMUNITY', 'INFERRED', 'UNVERIFIED', 'OUTDATED', 'DISPUTED']).optional(),
  notes: z.string().max(500).optional(),
}).strict();

const factReverificationSchema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'LIVE', 'COMMUNITY', 'INFERRED', 'UNVERIFIED', 'OUTDATED', 'DISPUTED']),
  notes: z.string().max(500).optional(),
}).strict();

const factIdParamSchema = z.object({
  factId: z.string().uuid(),
}).strict();

const feedbackIdParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

type FeedbackWithReviewRelations = Prisma.FeedbackGetPayload<{
  include: {
    user: { select: { id: true; email: true; name: true } };
    fact: true;
  };
}>;

function toFeedbackResponse(feedback: FeedbackWithReviewRelations) {
  return {
    id: feedback.id,
    userId: feedback.userId,
    entityType: feedback.entityType,
    entityId: feedback.entityId,
    feedbackType: feedback.feedbackType,
    factId: feedback.factId,
    submittedValue: feedback.submittedValue,
    note: feedback.note,
    status: feedback.status,
    createdAt: feedback.createdAt.toISOString(),
    user: feedback.user
      ? {
          id: feedback.user.id,
          email: feedback.user.email,
          name: feedback.user.name,
        }
      : undefined,
    fact: feedback.fact
      ? {
          id: feedback.fact.id,
          entityType: feedback.fact.entityType,
          entityId: feedback.fact.entityId,
          factKey: feedback.fact.factKey,
          factValue: feedback.fact.factValue,
          verificationStatus: feedback.fact.verificationStatus,
          confidence: feedback.fact.confidence,
          lastChecked: feedback.fact.lastChecked.toISOString(),
        }
      : null,
  };
}

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

    // ─── Feature 5: Community Verification State Machine ─────────────────────
    // After accepting the feedback, check if this fact has accumulated enough
    // independent reports to auto-transition to NEEDS_REVIEW.
    // Threshold: ≥3 independent reports (from different users) within 7 days.
    // This is a deterministic threshold rule, NOT an LLM judgment.
    if (factId) {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentReports = await prisma.feedback.findMany({
          where: {
            factId,
            status: 'PENDING',
            createdAt: { gte: sevenDaysAgo },
          },
          select: { userId: true },
        });

        // Count unique reporters
        const uniqueReporters = new Set(recentReports.map((r) => r.userId));

        // Threshold: 3 independent reporters
        if (uniqueReporters.size >= 3) {
          const fact = await prisma.fact.findUnique({ where: { id: factId } });
          // Only transition VERIFIED/LIVE facts to NEEDS_REVIEW — 
          // don't double-demote already-low-trust facts
          if (fact && (fact.verificationStatus === 'VERIFIED' || fact.verificationStatus === 'LIVE')) {
            await prisma.fact.update({
              where: { id: factId },
              data: { verificationStatus: 'DISPUTED' }, // Using DISPUTED as proxy for NEEDS_REVIEW until schema migration
            });
            console.log(`[Community Verification] Fact ${factId} auto-transitioned to NEEDS_REVIEW (${uniqueReporters.size} independent reports)`);
          }
        }
      } catch (stateErr) {
        // State machine failure is non-critical — don't break the feedback response
        console.error('[Community Verification] State machine error:', stateErr);
      }
    }
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

router.get('/admin/review-queue', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const query = reviewQueueQuerySchema.parse(req.query);
    const feedback = await prisma.feedback.findMany({
      where: { status: query.status },
      include: {
        user: { select: { id: true, email: true, name: true } },
        fact: true,
      },
      orderBy: { createdAt: 'asc' },
      take: query.limit,
    });

    res.json({
      data: feedback.map(toFeedbackResponse),
      meta: { status: query.status, limit: query.limit },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid review queue query', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

router.patch('/admin/:id/review', requireAuth, requireAdmin, sanitizeBody, async (req, res, next) => {
  try {
    const { id } = feedbackIdParamSchema.parse(req.params);
    const payload = feedbackReviewSchema.parse(req.body);

    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Feedback not found', 404, 'FEEDBACK_NOT_FOUND');
    }

    if (payload.factVerificationStatus && !existing.factId) {
      throw new AppError('Only fact feedback can update fact verification status', 400, 'INVALID_REVIEW_TARGET');
    }

    const result = await prisma.$transaction(async (tx) => {
      let verificationRecord = null;

      if (payload.factVerificationStatus && existing.factId) {
        const fact = await tx.fact.update({
          where: { id: existing.factId },
          data: {
            verificationStatus: payload.factVerificationStatus,
            lastChecked: new Date(),
          },
        });

        verificationRecord = await tx.verificationRecord.create({
          data: {
            factId: fact.id,
            checkedBy: `admin:${req.user!.email}`,
            result: payload.factVerificationStatus,
            notes: payload.notes ?? `Feedback ${payload.status.toLowerCase()}`,
          },
        });
      }

      const feedback = await tx.feedback.update({
        where: { id },
        data: { status: payload.status },
        include: {
          user: { select: { id: true, email: true, name: true } },
          fact: true,
        },
      });

      return { feedback, verificationRecord };
    });

    res.json({
      data: {
        feedback: toFeedbackResponse(result.feedback),
        verificationRecord: result.verificationRecord
          ? {
              id: result.verificationRecord.id,
              factId: result.verificationRecord.factId,
              checkedBy: result.verificationRecord.checkedBy,
              result: result.verificationRecord.result,
              notes: result.verificationRecord.notes,
              checkedAt: result.verificationRecord.checkedAt.toISOString(),
            }
          : null,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid feedback review payload', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

router.post('/admin/facts/:factId/reverify', requireAuth, requireAdmin, sanitizeBody, async (req, res, next) => {
  try {
    const { factId } = factIdParamSchema.parse(req.params);
    const payload = factReverificationSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const fact = await tx.fact.findUnique({ where: { id: factId } });
      if (!fact) {
        throw new AppError('Fact not found', 404, 'FACT_NOT_FOUND');
      }

      const updatedFact = await tx.fact.update({
        where: { id: factId },
        data: {
          verificationStatus: payload.verificationStatus,
          lastChecked: new Date(),
        },
      });

      const verificationRecord = await tx.verificationRecord.create({
        data: {
          factId,
          checkedBy: `admin:${req.user!.email}`,
          result: payload.verificationStatus,
          notes: payload.notes,
        },
      });

      return { fact: updatedFact, verificationRecord };
    });

    res.status(201).json({
      data: {
        fact: {
          id: result.fact.id,
          verificationStatus: result.fact.verificationStatus,
          lastChecked: result.fact.lastChecked.toISOString(),
        },
        verificationRecord: {
          id: result.verificationRecord.id,
          factId: result.verificationRecord.factId,
          checkedBy: result.verificationRecord.checkedBy,
          result: result.verificationRecord.result,
          notes: result.verificationRecord.notes,
          checkedAt: result.verificationRecord.checkedAt.toISOString(),
        },
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid fact re-verification payload', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

export default router;
