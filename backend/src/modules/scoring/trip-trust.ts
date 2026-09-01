/**
 * Feature 10: Trip Trust Score
 *
 * Deterministic aggregation of per-fact trust data, rolled up to trip level.
 * This is NOT a new independent judgment — it's literally surfacing data
 * the system already tracks per-fact.
 *
 * Formula:
 *   trustScore = weighted_sum / total_weight * freshness_factor
 *
 * Where:
 *   - VERIFIED/LIVE facts get weight 1.0
 *   - COMMUNITY facts get weight 0.7
 *   - INFERRED facts get weight 0.4
 *   - UNVERIFIED facts get weight 0.2
 *   - OUTDATED facts get weight 0.1
 *   - DISPUTED facts get weight 0.0
 *   - freshness_factor = 1.0 if avg lastChecked < 7 days, degrades linearly
 *
 * See SCORING_METHODOLOGY.md for full documentation.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { resolveSourceConflicts } from '../trust-validation/index.js';

const router = Router();

const tripIdParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

// ─── Trust Weights ──────────────────────────────────────────────────────────

const TRUST_WEIGHTS: Record<string, number> = {
  VERIFIED: 1.0,
  LIVE: 1.0,
  COMMUNITY: 0.7,
  INFERRED: 0.4,
  UNVERIFIED: 0.2,
  OUTDATED: 0.1,
  DISPUTED: 0.0,
  NEEDS_REVIEW: 0.15,
};

type TrustBreakdown = {
  verified: number;
  live: number;
  community: number;
  inferred: number;
  unverified: number;
  outdated: number;
  disputed: number;
  needs_review: number;
};

type TripTrustResult = {
  score: number; // 0-100
  label: string;
  breakdown: TrustBreakdown;
  totalFacts: number;
  unresolvedConflicts: number;
  avgFreshnessHours: number;
  freshnessFactor: number;
  computedAt: string;
};

function trustLabel(score: number): string {
  if (score >= 90) return 'Very High Confidence';
  if (score >= 75) return 'High Confidence';
  if (score >= 50) return 'Moderate Confidence';
  return 'Low Confidence';
}

// ─── GET /api/v1/scoring/trip-trust/:id ─────────────────────────────────────

router.get('/trip-trust/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = tripIdParamSchema.parse(req.params);

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        itineraries: {
          include: {
            items: {
              select: { entityId: true },
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

    const entityIds = trip.itineraries[0]?.items.map((i) => i.entityId) ?? [];

    // Fetch all facts for all attractions in the itinerary
    const facts = await prisma.fact.findMany({
      where: {
        entityType: 'attraction',
        entityId: { in: entityIds },
      },
      include: {
        source: { select: { name: true, sourceType: true } },
      },
    });

    // Build breakdown
    const breakdown: TrustBreakdown = {
      verified: 0,
      live: 0,
      community: 0,
      inferred: 0,
      unverified: 0,
      outdated: 0,
      disputed: 0,
      needs_review: 0,
    };

    let weightedSum = 0;
    let totalWeight = 0;
    let totalFreshnessMs = 0;
    const now = Date.now();

    for (const fact of facts) {
      const status = fact.verificationStatus.toLowerCase() as keyof TrustBreakdown;
      if (status in breakdown) breakdown[status]++;

      const weight = TRUST_WEIGHTS[fact.verificationStatus] ?? 0.2;
      weightedSum += weight;
      totalWeight += 1.0; // each fact counts equally toward the denominator

      totalFreshnessMs += now - fact.lastChecked.getTime();
    }

    // Freshness factor: 1.0 if avg lastChecked < 7 days, degrades linearly to 0.5 at 30 days
    const avgFreshnessHours = facts.length > 0
      ? (totalFreshnessMs / facts.length) / (1000 * 60 * 60)
      : 0;
    const FRESH_THRESHOLD_HOURS = 7 * 24;
    const STALE_THRESHOLD_HOURS = 30 * 24;
    let freshnessFactor = 1.0;
    if (avgFreshnessHours > FRESH_THRESHOLD_HOURS) {
      const staleness = Math.min(1.0,
        (avgFreshnessHours - FRESH_THRESHOLD_HOURS) / (STALE_THRESHOLD_HOURS - FRESH_THRESHOLD_HOURS)
      );
      freshnessFactor = 1.0 - staleness * 0.5; // degrades from 1.0 to 0.5
    }

    // Count unresolved conflicts using existing trust-validation logic
    // Group facts by entityId + factKey to detect conflicts
    let unresolvedConflicts = 0;
    const factGroups = new Map<string, typeof facts>();
    for (const fact of facts) {
      const key = `${fact.entityId}:${fact.factKey}`;
      const group = factGroups.get(key) ?? [];
      group.push(fact);
      factGroups.set(key, group);
    }

    for (const group of factGroups.values()) {
      if (group.length > 1) {
        const provenances = group.map((f) => ({
          fact_id: f.id,
          fact_key: f.factKey,
          fact_value: f.factValue,
          source_name: f.source.name,
          source_type: f.source.sourceType,
          verification_status: f.verificationStatus,
          confidence: f.confidence,
          timestamp: f.timestamp.toISOString(),
          last_checked: f.lastChecked.toISOString(),
        }));

        const resolved = resolveSourceConflicts(provenances as any);
        if (resolved === 'DISPUTED') unresolvedConflicts++;
      }
    }

    // Final score
    const rawScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
    const score = Math.round(rawScore * freshnessFactor);

    const result: TripTrustResult = {
      score: Math.max(0, Math.min(100, score)),
      label: trustLabel(score),
      breakdown,
      totalFacts: facts.length,
      unresolvedConflicts,
      avgFreshnessHours: Math.round(avgFreshnessHours),
      freshnessFactor: Math.round(freshnessFactor * 100) / 100,
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
