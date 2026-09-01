/**
 * Feature 8: Group Conflict Resolver
 *
 * Multiple participants submit preferences tied to the same trip.
 * The deterministic planner runs with a BLENDED constraint set:
 *   - Hard constraints (accessibility, walking tolerance, budget ceiling)
 *     take the STRICTEST value across the group
 *   - Soft constraints (interest weighting) are blended proportionally
 *
 * The LLM explains the trade-off using the real computed allocation.
 */

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';
import { generateItinerary, type PlannerInput, type PlannerPreferences } from '../planner/engine.js';

const router = Router();

// In-memory store for group trips (in production, this would be in the DB)
// Using a Map keyed by join code for simplicity
type GroupParticipant = {
  name: string;
  preferences: PlannerPreferences;
  submittedAt: string;
};

type GroupTrip = {
  id: string;
  joinCode: string;
  creatorId: string;
  destinationId: string;
  startDate: string;
  days: number;
  title: string;
  participants: GroupParticipant[];
  createdAt: string;
};

const groupTrips = new Map<string, GroupTrip>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createGroupSchema = z.object({
  destinationId: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  days: z.number().int().min(1).max(14),
  title: z.string().min(1).max(200).default('Group Trip'),
}).strict();

const joinGroupSchema = z.object({
  name: z.string().min(1).max(100),
  preferences: z.object({
    pace: z.enum(['RELAXED', 'MODERATE', 'PACKED']).default('MODERATE'),
    accessibilityWheelchair: z.boolean().default(false),
    accessibilityVision: z.boolean().default(false),
    accessibilityHearing: z.boolean().default(false),
    accessibilityCognitive: z.boolean().default(false),
    interests: z.array(z.string().max(50)).max(20).default([]),
    transportPreference: z.enum(['WALKING', 'PUBLIC_TRANSIT', 'CAB', 'OWN_VEHICLE', 'MIXED']).default('MIXED'),
    walkingToleranceMinutes: z.number().int().min(5).max(240).default(30).optional(),
  }).strict(),
}).strict();

const codeParamSchema = z.object({
  code: z.string().min(6).max(20),
}).strict();

function generateJoinCode(): string {
  return randomBytes(4).toString('hex').toUpperCase(); // 8-char hex code
}

// ─── Blending Logic ─────────────────────────────────────────────────────────

/**
 * Blends multiple participant preferences into a single constraint set.
 * Hard constraints: strictest value. Soft constraints: proportional blend.
 */
function blendPreferences(participants: GroupParticipant[]): {
  blended: PlannerPreferences;
  allocation: Record<string, number>;
  constraints: string[];
} {
  const constraints: string[] = [];

  // Hard constraints: take the strictest value
  const accessibilityWheelchair = participants.some((p) => p.preferences.accessibilityWheelchair);
  const accessibilityVision = participants.some((p) => p.preferences.accessibilityVision);
  const accessibilityHearing = participants.some((p) => p.preferences.accessibilityHearing);
  const accessibilityCognitive = participants.some((p) => p.preferences.accessibilityCognitive);

  if (accessibilityWheelchair) {
    constraints.push('Wheelchair accessibility required (strictest across group)');
  }

  // Walking tolerance: take the minimum (most restrictive)
  const walkingTolerances = participants
    .map((p) => p.preferences.walkingToleranceMinutes)
    .filter((v): v is number => v !== undefined);
  const walkingToleranceMinutes = walkingTolerances.length > 0
    ? Math.min(...walkingTolerances)
    : 30;
  if (walkingTolerances.length > 1) {
    constraints.push(`Walking limited to ${walkingToleranceMinutes} minutes (group's lowest tolerance)`);
  }

  // Pace: take the most relaxed (strictest time constraint)
  const paceRank: Record<string, number> = { RELAXED: 0, MODERATE: 1, PACKED: 2 };
  const paces = participants.map((p) => p.preferences.pace);
  const minPaceRank = Math.min(...paces.map((p) => paceRank[p] ?? 1));
  const pace = (['RELAXED', 'MODERATE', 'PACKED'] as const)[minPaceRank];
  if (new Set(paces).size > 1) {
    constraints.push(`Pace set to ${pace} (most relaxed preference in group)`);
  }

  // Soft constraints: blend interests proportionally
  const interestCounts = new Map<string, number>();
  for (const participant of participants) {
    for (const interest of participant.preferences.interests) {
      interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
    }
  }

  // Sort interests by how many participants want them
  const sortedInterests = Array.from(interestCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([interest]) => interest);

  // Compute allocation as percentage
  const totalVotes = Array.from(interestCounts.values()).reduce((s, v) => s + v, 0);
  const allocation: Record<string, number> = {};
  for (const [interest, count] of interestCounts) {
    allocation[interest] = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
  }

  // Transport: prefer MIXED if there's disagreement
  const transports = new Set(participants.map((p) => p.preferences.transportPreference));
  const transportPreference = transports.size === 1
    ? participants[0].preferences.transportPreference
    : 'MIXED';
  if (transports.size > 1) {
    constraints.push('Transport set to MIXED (group has different preferences)');
  }

  const blended: PlannerPreferences = {
    pace,
    accessibilityWheelchair,
    accessibilityVision,
    accessibilityHearing,
    accessibilityCognitive,
    interests: sortedInterests,
    transportPreference,
    walkingToleranceMinutes,
  };

  return { blended, allocation, constraints };
}

// ─── POST /api/v1/groups — create a group trip ──────────────────────────────

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createGroupSchema.parse(req.body);
    const destinationId = resolveDestinationId(parsed.destinationId);

    // Verify destination exists
    const destination = await prisma.destination.findUnique({ where: { id: destinationId } });
    if (!destination) throw new AppError('Destination not found', 404, 'NOT_FOUND');

    const joinCode = generateJoinCode();
    const group: GroupTrip = {
      id: randomBytes(16).toString('hex'),
      joinCode,
      creatorId: req.user!.userId,
      destinationId,
      startDate: parsed.startDate,
      days: parsed.days,
      title: parsed.title,
      participants: [],
      createdAt: new Date().toISOString(),
    };

    groupTrips.set(joinCode, group);

    res.status(201).json({
      data: {
        id: group.id,
        joinCode: group.joinCode,
        title: group.title,
        destinationId,
        shareUrl: `/group/${joinCode}`,
        createdAt: group.createdAt,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid group trip data', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

// ─── POST /api/v1/groups/:code/join — submit participant preferences ────────

router.post('/:code/join', async (req, res, next) => {
  try {
    const { code } = codeParamSchema.parse(req.params);
    const { name, preferences } = joinGroupSchema.parse(req.body);

    const group = groupTrips.get(code);
    if (!group) throw new AppError('Group trip not found', 404, 'NOT_FOUND');

    if (group.participants.length >= 10) {
      throw new AppError('Group is full (max 10 participants)', 400, 'GROUP_FULL');
    }

    group.participants.push({
      name,
      preferences: preferences as PlannerPreferences,
      submittedAt: new Date().toISOString(),
    });

    res.status(201).json({
      data: {
        success: true,
        participantCount: group.participants.length,
        message: `${name} joined the group trip`,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid join data', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

// ─── GET /api/v1/groups/:code — get group status ────────────────────────────

router.get('/:code', async (req, res, next) => {
  try {
    const { code } = codeParamSchema.parse(req.params);
    const group = groupTrips.get(code);
    if (!group) throw new AppError('Group trip not found', 404, 'NOT_FOUND');

    res.json({
      data: {
        id: group.id,
        title: group.title,
        destinationId: group.destinationId,
        startDate: group.startDate,
        days: group.days,
        participantCount: group.participants.length,
        participants: group.participants.map((p) => ({
          name: p.name,
          interests: p.preferences.interests,
          pace: p.preferences.pace,
          submittedAt: p.submittedAt,
        })),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid group code', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

// ─── POST /api/v1/groups/:code/generate — generate blended itinerary ────────

router.post('/:code/generate', async (req, res, next) => {
  try {
    const { code } = codeParamSchema.parse(req.params);
    const group = groupTrips.get(code);
    if (!group) throw new AppError('Group trip not found', 404, 'NOT_FOUND');

    if (group.participants.length < 2) {
      throw new AppError('At least 2 participants required to generate a group itinerary', 400, 'INSUFFICIENT_PARTICIPANTS');
    }

    // Blend preferences deterministically
    const { blended, allocation, constraints } = blendPreferences(group.participants);

    const input: PlannerInput = {
      destinationId: group.destinationId,
      startDate: group.startDate,
      days: group.days,
      preferences: blended,
    };

    // Generate itinerary using the SAME deterministic engine
    const plan = await generateItinerary(input);

    res.json({
      data: {
        plan,
        blendedPreferences: blended,
        interestAllocation: allocation,
        constraints,
        participantCount: group.participants.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
