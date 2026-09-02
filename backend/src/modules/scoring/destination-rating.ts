/**
 * Destination fit ratings
 *
 * Deterministic scorer for ranking destinations against traveller inputs.
 * It uses only stored destination/attraction facts and simple seasonal rules.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';

const router = Router();

const paceSchema = z.enum(['RELAXED', 'MODERATE', 'PACKED']);
const budgetBandSchema = z.enum(['BUDGET', 'MODERATE', 'PREMIUM']);
const transportSchema = z.enum(['WALKING', 'PUBLIC_TRANSIT', 'CAB', 'OWN_VEHICLE', 'MIXED']);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM');
const dateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid travel date');

const preferencesSchema = z.object({
  pace: paceSchema.optional(),
  accessibilityWheelchair: z.boolean().optional(),
  accessibilityVision: z.boolean().optional(),
  accessibilityHearing: z.boolean().optional(),
  accessibilityCognitive: z.boolean().optional(),
  interests: z.array(z.string().max(50)).max(20).optional(),
  transportPreference: transportSchema.optional(),
  budgetBand: budgetBandSchema.optional(),
  preferredStartTime: timeSchema.optional(),
}).strict();

const destinationRatingRequestSchema = z.object({
  destinationIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  startDate: dateSchema.optional(),
  preferredTime: timeSchema.optional(),
  days: z.number().int().min(1).max(14).optional(),
  pace: paceSchema.optional(),
  accessibilityWheelchair: z.boolean().optional(),
  accessibilityVision: z.boolean().optional(),
  accessibilityHearing: z.boolean().optional(),
  accessibilityCognitive: z.boolean().optional(),
  interests: z.array(z.string().max(50)).max(20).optional(),
  transportPreference: transportSchema.optional(),
  budgetBand: budgetBandSchema.optional(),
  preferences: preferencesSchema.optional(),
}).strict();

type BudgetBand = z.infer<typeof budgetBandSchema>;
type Pace = z.infer<typeof paceSchema>;
type TransportPreference = z.infer<typeof transportSchema>;

export type DestinationRatingInput = {
  startDate?: string;
  preferredTime: string;
  days: number;
  pace: Pace;
  accessibilityWheelchair: boolean;
  accessibilityVision: boolean;
  accessibilityHearing: boolean;
  accessibilityCognitive: boolean;
  interests: string[];
  transportPreference: TransportPreference;
  budgetBand: BudgetBand;
};

type RateableFact = {
  factKey: string;
  verificationStatus: string;
  factValue: unknown;
};

export type RateableAttraction = {
  id: string;
  name: string;
  categories: string[];
  latitude: number;
  longitude: number;
  description?: string | null;
  indoorOutdoor: string;
  accessibilityWheelchair: boolean;
  accessibilityVisual: boolean;
  accessibilityHearing: boolean;
  accessibilityNotes?: string | null;
  facts?: RateableFact[];
};

export type RateableDestination = {
  id: string;
  name: string;
  country: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  attractions: RateableAttraction[];
};

type DestinationRatingBreakdown = {
  category: 'interests' | 'accessibility' | 'budget' | 'date_time' | 'pace_transport';
  score: number;
  weight: number;
  reasons: string[];
};

export type DestinationRating = {
  destinationId: string;
  destinationName: string;
  score: number;
  label: string;
  summary: string;
  topReasons: string[];
  breakdown: DestinationRatingBreakdown[];
  input: DestinationRatingInput;
  computedAt: string;
};

const WEIGHTS: Record<DestinationRatingBreakdown['category'], number> = {
  interests: 25,
  accessibility: 25,
  budget: 20,
  date_time: 20,
  pace_transport: 10,
};

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'travel']);

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function attractionText(attraction: RateableAttraction) {
  return [
    attraction.name,
    attraction.description ?? '',
    attraction.accessibilityNotes ?? '',
    ...attraction.categories,
  ].join(' ');
}

function hasInterestMatch(attraction: RateableAttraction, interestTokens: Set<string>) {
  if (interestTokens.size === 0) return false;
  const attractionTokens = new Set(tokens(attractionText(attraction)));
  return [...interestTokens].some((token) => attractionTokens.has(token));
}

function priceFromFact(facts: RateableFact[] = []) {
  const fact = facts.find((item) =>
    item.factKey === 'ticket_price' &&
    ['VERIFIED', 'LIVE'].includes(item.verificationStatus) &&
    item.factValue &&
    typeof item.factValue === 'object' &&
    !Array.isArray(item.factValue)
  );
  const amount = fact ? (fact.factValue as Record<string, unknown>).amount : undefined;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null;
}

function estimatedTicketPrice(attraction: RateableAttraction) {
  const verified = priceFromFact(attraction.facts);
  if (verified !== null) return verified;

  const text = attractionText(attraction).toLowerCase();
  if (/(market|temple|beach|ghat|park|garden|street|village)/.test(text)) return 0;
  if (/(museum|palace|fort|heritage|architecture|monument|cave)/.test(text)) return 80;
  if (/(zoo|safari|adventure|water|boat)/.test(text)) return 250;
  return 120;
}

function labelFor(score: number, attractionCount: number) {
  if (attractionCount === 0) return 'Limited Data';
  if (score >= 85) return 'Excellent Fit';
  if (score >= 70) return 'Good Fit';
  if (score >= 55) return 'Fair Fit';
  return 'Weak Fit';
}

function paceLimit(pace: Pace) {
  if (pace === 'RELAXED') return 2;
  if (pace === 'PACKED') return 5;
  return 3;
}

function interestBreakdown(destination: RateableDestination, input: DestinationRatingInput): DestinationRatingBreakdown {
  if (destination.attractions.length === 0) {
    return { category: 'interests', score: 40, weight: WEIGHTS.interests, reasons: ['No attraction records available to compare interests'] };
  }
  if (input.interests.length === 0) {
    return { category: 'interests', score: 80, weight: WEIGHTS.interests, reasons: ['No specific interests selected'] };
  }

  const interestTokens = new Set(input.interests.flatMap(tokens));
  const matches = destination.attractions.filter((attraction) => hasInterestMatch(attraction, interestTokens)).length;
  const score = clamp(35 + (matches / destination.attractions.length) * 65);
  return {
    category: 'interests',
    score,
    weight: WEIGHTS.interests,
    reasons: [`${matches}/${destination.attractions.length} attractions match selected interests`],
  };
}

function accessibilityBreakdown(destination: RateableDestination, input: DestinationRatingInput): DestinationRatingBreakdown {
  const requested = [
    ['wheelchair', input.accessibilityWheelchair, (a: RateableAttraction) => a.accessibilityWheelchair],
    ['visual', input.accessibilityVision, (a: RateableAttraction) => a.accessibilityVisual],
    ['hearing', input.accessibilityHearing, (a: RateableAttraction) => a.accessibilityHearing],
    ['cognitive', input.accessibilityCognitive, (a: RateableAttraction) => /cognitive|quiet|sensory/i.test(a.accessibilityNotes ?? '')],
  ] as const;
  const active = requested.filter(([, enabled]) => enabled);

  if (destination.attractions.length === 0) {
    return { category: 'accessibility', score: active.length ? 35 : 80, weight: WEIGHTS.accessibility, reasons: ['No accessibility records available'] };
  }
  if (active.length === 0) {
    return { category: 'accessibility', score: 100, weight: WEIGHTS.accessibility, reasons: ['No accessibility needs selected'] };
  }

  const scores = active.map(([label, , check]) => {
    const supported = destination.attractions.filter((attraction) => check(attraction)).length;
    return { label, supported, score: (supported / destination.attractions.length) * 100 };
  });
  const score = clamp(scores.reduce((sum, item) => sum + item.score, 0) / scores.length);
  return {
    category: 'accessibility',
    score,
    weight: WEIGHTS.accessibility,
    reasons: scores.map((item) => `${item.supported}/${destination.attractions.length} stops support ${item.label} access`),
  };
}

function budgetBreakdown(destination: RateableDestination, input: DestinationRatingInput): DestinationRatingBreakdown {
  if (destination.attractions.length === 0) {
    return { category: 'budget', score: 45, weight: WEIGHTS.budget, reasons: ['No price records available'] };
  }

  const limitByBand: Record<BudgetBand, number> = {
    BUDGET: 100,
    MODERATE: 350,
    PREMIUM: 1000,
  };
  const limit = limitByBand[input.budgetBand];
  const prices = destination.attractions.map(estimatedTicketPrice);
  const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const withinBudget = prices.filter((price) => price <= limit).length;
  const score = clamp((withinBudget / prices.length) * 70 + Math.max(0, 30 - (avgPrice / limit) * 20));

  return {
    category: 'budget',
    score,
    weight: WEIGHTS.budget,
    reasons: [`${withinBudget}/${prices.length} stops fit ${input.budgetBand.toLowerCase()} ticket assumptions`],
  };
}

function outdoorShare(destination: RateableDestination) {
  if (destination.attractions.length === 0) return 0.5;
  const exposure = destination.attractions.reduce((sum, attraction) => {
    if (attraction.indoorOutdoor === 'outdoor') return sum + 1;
    if (attraction.indoorOutdoor === 'mixed') return sum + 0.5;
    return sum;
  }, 0);
  return exposure / destination.attractions.length;
}

function dateTimeBreakdown(destination: RateableDestination, input: DestinationRatingInput): DestinationRatingBreakdown {
  const date = input.startDate ? new Date(input.startDate) : new Date();
  const month = date.getMonth() + 1;
  const hour = Number(input.preferredTime.split(':')[0]);
  const destinationText = `${destination.name} ${destination.region ?? ''}`.toLowerCase();
  const outdoor = outdoorShare(destination);
  const reasons: string[] = [];
  let penalty = 0;

  if (month >= 4 && month <= 6 && /(rajasthan|jaipur|agra|uttar pradesh|varanasi|odisha)/.test(destinationText)) {
    penalty += 20 * outdoor;
    reasons.push('Hot-season travel lowers outdoor comfort');
  }

  if (month >= 6 && month <= 9 && /(goa|kerala|odisha|puri|konark|west bengal|darjeeling)/.test(destinationText)) {
    penalty += 25 * outdoor;
    reasons.push('Monsoon season lowers outdoor reliability');
  }

  if (month >= 12 || month <= 2) {
    penalty -= /rajasthan|uttar pradesh|odisha|goa|kerala/.test(destinationText) ? 8 : 0;
    reasons.push('Winter travel is generally comfortable for this region');
  }

  if (hour >= 12 && hour <= 16) {
    penalty += 18 * outdoor;
    reasons.push('Afternoon start can be harder for outdoor-heavy days');
  } else if (hour >= 6 && hour <= 10) {
    penalty -= 5;
    reasons.push('Morning start improves outdoor comfort');
  }

  return {
    category: 'date_time',
    score: clamp(100 - penalty),
    weight: WEIGHTS.date_time,
    reasons: reasons.length ? reasons : ['Travel date and start time look compatible'],
  };
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const latKm = (a.latitude - b.latitude) * 111;
  const lonKm = (a.longitude - b.longitude) * 111 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(latKm * latKm + lonKm * lonKm);
}

function paceTransportBreakdown(destination: RateableDestination, input: DestinationRatingInput): DestinationRatingBreakdown {
  if (destination.attractions.length === 0) {
    return { category: 'pace_transport', score: 40, weight: WEIGHTS.pace_transport, reasons: ['No attraction density data available'] };
  }

  const expectedStops = input.days * paceLimit(input.pace);
  const densityScore = clamp(Math.min(1, destination.attractions.length / expectedStops) * 100);
  const avgDistance = destination.attractions.reduce((sum, attraction) => sum + distanceKm(destination, attraction), 0) / destination.attractions.length;

  let transportScore = 90;
  if (input.transportPreference === 'WALKING') {
    transportScore = avgDistance <= 2 ? 100 : avgDistance <= 5 ? 75 : avgDistance <= 10 ? 50 : 25;
  } else if (input.transportPreference === 'PUBLIC_TRANSIT') {
    transportScore = avgDistance <= 8 ? 85 : 65;
  }

  return {
    category: 'pace_transport',
    score: clamp((densityScore + transportScore) / 2),
    weight: WEIGHTS.pace_transport,
    reasons: [
      `${destination.attractions.length} known stops for ${expectedStops} planned slots`,
      `${Math.round(avgDistance)} km average distance from destination center`,
    ],
  };
}

export function normalizeDestinationRatingInput(
  raw: z.infer<typeof destinationRatingRequestSchema>,
): DestinationRatingInput {
  const preferences = raw.preferences ?? {};
  return {
    startDate: raw.startDate,
    preferredTime: raw.preferredTime ?? preferences.preferredStartTime ?? '09:00',
    days: raw.days ?? 3,
    pace: raw.pace ?? preferences.pace ?? 'MODERATE',
    accessibilityWheelchair: raw.accessibilityWheelchair ?? preferences.accessibilityWheelchair ?? false,
    accessibilityVision: raw.accessibilityVision ?? preferences.accessibilityVision ?? false,
    accessibilityHearing: raw.accessibilityHearing ?? preferences.accessibilityHearing ?? false,
    accessibilityCognitive: raw.accessibilityCognitive ?? preferences.accessibilityCognitive ?? false,
    interests: raw.interests ?? preferences.interests ?? [],
    transportPreference: raw.transportPreference ?? preferences.transportPreference ?? 'MIXED',
    budgetBand: raw.budgetBand ?? preferences.budgetBand ?? 'MODERATE',
  };
}

export function rateDestination(
  destination: RateableDestination,
  input: DestinationRatingInput,
  computedAt = new Date().toISOString(),
): DestinationRating {
  const breakdown = [
    interestBreakdown(destination, input),
    accessibilityBreakdown(destination, input),
    budgetBreakdown(destination, input),
    dateTimeBreakdown(destination, input),
    paceTransportBreakdown(destination, input),
  ];
  const totalWeight = breakdown.reduce((sum, item) => sum + item.weight, 0);
  const score = clamp(breakdown.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
  const lowest = [...breakdown].sort((a, b) => a.score - b.score).slice(0, 2);
  const strongest = [...breakdown].sort((a, b) => b.score - a.score)[0];
  const topReasons = [
    ...(strongest ? strongest.reasons.slice(0, 1) : []),
    ...lowest.flatMap((item) => item.reasons.slice(0, 1)),
  ].slice(0, 3);

  return {
    destinationId: destination.id,
    destinationName: destination.name,
    score,
    label: labelFor(score, destination.attractions.length),
    summary: topReasons[0] ?? 'Destination fit computed from current inputs',
    topReasons,
    breakdown,
    input,
    computedAt,
  };
}

router.post('/destination-ratings', async (req, res, next) => {
  try {
    const raw = destinationRatingRequestSchema.parse(req.body);
    const input = normalizeDestinationRatingInput(raw);
    const destinationIds = raw.destinationIds?.map(resolveDestinationId);

    const destinations = await prisma.destination.findMany({
      where: destinationIds?.length ? { id: { in: destinationIds } } : undefined,
      include: {
        attractions: {
          include: {
            facts: {
              select: {
                factKey: true,
                verificationStatus: true,
                factValue: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const computedAt = new Date().toISOString();
    const ratings = destinations
      .map((destination) => rateDestination(destination, input, computedAt))
      .sort((a, b) => b.score - a.score || a.destinationName.localeCompare(b.destinationName));

    res.json({ data: { ratings, input, computedAt } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid destination rating request', details: err.flatten().fieldErrors },
      });
      return;
    }
    next(err);
  }
});

export default router;
