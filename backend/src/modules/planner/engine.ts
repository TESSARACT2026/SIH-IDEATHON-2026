/**
 * Deterministic Planner Engine
 *
 * Core scheduling logic extracted from the planner route handler.
 * This module is the SINGLE code path for both initial itinerary generation
 * and "What If?" replanning. The LLM never decides the schedule —
 * it only narrates the result afterward.
 *
 * Constraint deltas (weather, time, crowd, budget) are applied as overrides
 * to the same sorting, filtering, and scheduling functions used for initial
 * generation — there is no separate ad-hoc code path.
 */

import type { Prisma } from '@prisma/client';
import { VerificationStatus } from '../../shared/types/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { getRoute } from '../live-data/routing.js';

// ─── Constants ───────────────────────────────────────────────────────────────

export const DAY_START = '09:00';
export const DAY_END = '18:00';
export const VISIT_DURATION_MINUTES = 120;
export const ROUTING_FALLBACK_MINUTES = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlannerAttraction = Prisma.AttractionGetPayload<{
  include: {
    destination: true;
    facts: {
      include: {
        source: {
          select: {
            name: true;
            sourceType: true;
          };
        };
      };
    };
    crowdRecords: true;
    sensitivityFlags: true;
  };
}>;

export type PlannerPreferences = {
  pace: 'RELAXED' | 'MODERATE' | 'PACKED';
  accessibilityWheelchair: boolean;
  accessibilityVision: boolean;
  accessibilityHearing: boolean;
  accessibilityCognitive: boolean;
  interests: string[];
  transportPreference: 'WALKING' | 'PUBLIC_TRANSIT' | 'CAB' | 'OWN_VEHICLE' | 'MIXED';
  groupType?: 'SOLO' | 'COUPLE' | 'FAMILY' | 'GROUP';
  walkingToleranceMinutes?: number;
  indoorOutdoorPreference?: 'indoor' | 'outdoor' | 'mixed';
  localBusinessPreference?: boolean;
};

export type PlannerInput = {
  destinationId: string;
  startDate: string;
  endDate?: string;
  days: number;
  title?: string;
  saveTrip?: boolean;
  preferences: PlannerPreferences;
};

export type Exclusion = {
  entityId: string;
  attractionName: string;
  reason: string;
  verificationStatus: VerificationStatus;
};

export type ItineraryItem = {
  dayNumber: number;
  sequence: number;
  entityType: string;
  entityId: string;
  attractionName: string;
  startTime: string;
  endTime: string;
  travelBufferMinutesBefore: number;
  factIds: string[];
  trustSummary: ReturnType<typeof buildTrustSummary>;
};

/**
 * Constraint overrides for replanning ("What If?" scenarios).
 * Each field, when set, modifies the planner's behavior.
 */
export type PlannerOverrides = {
  /** Force indoor-only or mixed candidates (e.g., rain scenario) */
  indoorOnly?: boolean;
  /** Limit indoor-only behavior to these trip day numbers. Empty/omitted means all days. */
  indoorOnlyDays?: number[];
  /** Override the day end time (e.g., "less time" scenario) */
  dayEndOverride?: string;
  /** Override the number of days */
  daysOverride?: number;
  /** Exclude HIGH crowd level in addition to SEVERE */
  strictCrowdFilter?: boolean;
  /** Budget ceiling per person in INR — prefer cheaper attractions */
  budgetCeilingPerPerson?: number;
  /** Extra interest weights for responsible routing */
  localBusinessPreferenceWeight?: number;
  /** Crowd avoidance weight multiplier for responsible routing */
  crowdAvoidanceWeight?: number;
};

export type PlanResult = {
  destinationId: string;
  days: number;
  itineraryItems: ItineraryItem[];
  excluded: Exclusion[];
  warnings: string[];
};

// ─── Utility Functions ───────────────────────────────────────────────────────

export const timeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (mins: number) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const paceLimit = (pace: PlannerPreferences['pace']) => {
  if (pace === 'RELAXED') return 2;
  if (pace === 'PACKED') return 5;
  return 3;
};

export const verifiedTicketPrice = (facts: PlannerAttraction['facts']) => {
  const priceFact = facts.find(
    (fact) =>
      fact.factKey === 'ticket_price' &&
      (fact.verificationStatus === VerificationStatus.VERIFIED || fact.verificationStatus === VerificationStatus.LIVE)
  );

  if (!priceFact || typeof priceFact.factValue !== 'object' || priceFact.factValue === null || Array.isArray(priceFact.factValue)) {
    return null;
  }

  const amount = (priceFact.factValue as Record<string, unknown>).amount;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null;
};

export const riskRank: Record<VerificationStatus, number> = {
  [VerificationStatus.LIVE]: 0,
  [VerificationStatus.VERIFIED]: 1,
  [VerificationStatus.COMMUNITY]: 2,
  [VerificationStatus.INFERRED]: 3,
  [VerificationStatus.UNVERIFIED]: 4,
  [VerificationStatus.OUTDATED]: 5,
  [VerificationStatus.DISPUTED]: 6,
};

// ─── Fact & Trust ────────────────────────────────────────────────────────────

export const factToProvenance = (fact: PlannerAttraction['facts'][number]) => ({
  fact_id: fact.id,
  fact_key: fact.factKey,
  fact_value: fact.factValue,
  source_name: fact.source.name,
  source_type: fact.source.sourceType,
  verification_status: fact.verificationStatus,
  confidence: fact.confidence,
  timestamp: fact.timestamp.toISOString(),
  last_checked: fact.lastChecked.toISOString(),
  geographic_scope: fact.geographicScope ?? undefined,
});

export const buildTrustSummary = (attraction: PlannerAttraction, warnings: string[]) => {
  const facts = attraction.facts
    .filter((fact) => ['opening_hours', 'ticket_price', 'accessibility', 'entry_restrictions'].includes(fact.factKey))
    .map(factToProvenance);

  const overallStatus = facts.reduce<VerificationStatus>(
    (worst, fact) => riskRank[fact.verification_status as VerificationStatus] > riskRank[worst] ? (fact.verification_status as VerificationStatus) : worst,
    facts.length > 0 ? (facts[0].verification_status as VerificationStatus) : VerificationStatus.UNVERIFIED,
  );

  return {
    overall_status: overallStatus,
    facts,
    warnings,
  };
};

// ─── Opening Hours ───────────────────────────────────────────────────────────

export const openingWindow = (attraction: PlannerAttraction, warnings: string[]) => {
  const hoursFact = attraction.facts.find((fact) => fact.factKey === 'opening_hours');

  if (
    !hoursFact ||
    (hoursFact.verificationStatus !== VerificationStatus.VERIFIED &&
      hoursFact.verificationStatus !== VerificationStatus.LIVE)
  ) {
    warnings.push('Opening hours not verified; confirm before visiting');
    return null;
  }

  if (typeof hoursFact.factValue !== 'object' || hoursFact.factValue === null || Array.isArray(hoursFact.factValue)) {
    warnings.push('Opening hours not verified; confirm before visiting');
    return null;
  }

  const value = hoursFact.factValue as { open?: unknown; close?: unknown };
  if (typeof value.open !== 'string' || typeof value.close !== 'string') {
    warnings.push('Opening hours not verified; confirm before visiting');
    return null;
  }

  return {
    open: timeToMinutes(value.open),
    close: timeToMinutes(value.close),
  };
};

// ─── Sensitivity & Exclusion ─────────────────────────────────────────────────

export const activeSensitivityFlag = (attraction: PlannerAttraction, tripStart: Date) => {
  return attraction.sensitivityFlags.find((flag) => {
    const startsBeforeTrip = !flag.activeFrom || flag.activeFrom <= tripStart;
    const endsAfterTrip = !flag.activeTo || flag.activeTo >= tripStart;
    return startsBeforeTrip && endsAfterTrip;
  });
};

export const exclusionFor = (
  attraction: PlannerAttraction,
  tripStart: Date,
  overrides?: PlannerOverrides,
): Exclusion | null => {
  const crowd = attraction.crowdRecords[0];

  // Default: exclude SEVERE. With strictCrowdFilter: also exclude HIGH.
  if (crowd?.currentCrowdLevel === 'SEVERE') {
    return {
      entityId: attraction.id,
      attractionName: attraction.name,
      reason: 'Excluded because current crowd level is severe',
      verificationStatus: crowd.verificationStatus as VerificationStatus,
    };
  }

  if (overrides?.strictCrowdFilter && crowd?.currentCrowdLevel === 'HIGH') {
    return {
      entityId: attraction.id,
      attractionName: attraction.name,
      reason: 'Excluded because current crowd level is high (strict crowd filter applied)',
      verificationStatus: crowd.verificationStatus as VerificationStatus,
    };
  }

  const sensitivity = activeSensitivityFlag(attraction, tripStart);
  if (sensitivity) {
    return {
      entityId: attraction.id,
      attractionName: attraction.name,
      reason: sensitivity.description || `Excluded because of active ${sensitivity.sensitivityType.toLowerCase()} sensitivity flag`,
      verificationStatus: VerificationStatus.VERIFIED,
    };
  }

  return null;
};

// ─── Scheduling ──────────────────────────────────────────────────────────────

export const getTransitionMinutes = async (
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number },
  transportPreference: PlannerPreferences['transportPreference'],
  warnings: string[],
) => {
  if (!from) return 0;

  try {
    const profile = transportPreference === 'WALKING' ? 'foot-walking' : 'driving-car';
    const route = await getRoute(from.latitude, from.longitude, to.latitude, to.longitude, profile);
    const travelMinutes = Math.ceil(route.duration_seconds / 60);
    return travelMinutes + Math.max(10, Math.ceil(travelMinutes * 0.15));
  } catch {
    warnings.push('Routing unavailable; estimated buffer used');
    return ROUTING_FALLBACK_MINUTES + Math.max(10, Math.ceil(ROUTING_FALLBACK_MINUTES * 0.15));
  }
};

export const canSchedule = async (
  candidate: PlannerAttraction,
  currentMinutes: number,
  lastLocation: { latitude: number; longitude: number } | null,
  input: PlannerInput,
  dayEnd: string = DAY_END,
) => {
  const itemWarnings: string[] = [];
  const transitionMinutes = await getTransitionMinutes(
    lastLocation,
    { latitude: candidate.latitude, longitude: candidate.longitude },
    input.preferences.transportPreference,
    itemWarnings,
  );
  let startMinutes = currentMinutes + transitionMinutes;

  const hours = openingWindow(candidate, itemWarnings);
  if (hours) {
    startMinutes = Math.max(startMinutes, hours.open);
    if (startMinutes + VISIT_DURATION_MINUTES > hours.close) return null;
  }

  if (startMinutes + VISIT_DURATION_MINUTES > timeToMinutes(dayEnd)) return null;

  return {
    startMinutes,
    endMinutes: startMinutes + VISIT_DURATION_MINUTES,
    transitionMinutes,
    itemWarnings,
  };
};

// ─── Candidate Sorting ───────────────────────────────────────────────────────

export const sortCandidates = async (
  input: PlannerInput,
  warnings: string[],
  overrides?: PlannerOverrides,
) => {
  const destination = await prisma.destination.findUnique({ where: { id: input.destinationId } });

  if (!destination) {
    throw new AppError('Destination not found', 404, 'DESTINATION_NOT_FOUND');
  }

  let orderedIds: string[] = [];
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM attractions
      WHERE destination_id = ${input.destinationId}
      ORDER BY ST_Distance(
        ST_MakePoint(longitude, latitude)::geography,
        ST_MakePoint(${destination.longitude}, ${destination.latitude})::geography
      ) ASC
    `;
    orderedIds = rows.map((row) => row.id);
  } catch {
    warnings.push('PostGIS ordering unavailable; fallback ordering used');
  }

  const attractions = await prisma.attraction.findMany({
    where: { destinationId: input.destinationId },
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
  });

  const idOrder = new Map(orderedIds.map((id, index) => [id, index]));
  const interests = new Set(input.preferences.interests.map((interest) => interest.toLowerCase()));

  let filtered = attractions
    .filter((attraction) => !input.preferences.accessibilityWheelchair || attraction.accessibilityWheelchair);

  // Override: filter to indoor/mixed only (e.g., rain scenario)
  if (overrides?.indoorOnly) {
    filtered = filtered.filter((a) => a.indoorOutdoor === 'indoor' || a.indoorOutdoor === 'mixed');
  }

  // Override: budget ceiling — get ticket prices to sort by cost
  const ticketPriceMap = new Map<string, number>();
  if (overrides?.budgetCeilingPerPerson !== undefined) {
    for (const attraction of filtered) {
      const amount = verifiedTicketPrice(attraction.facts);
      if (amount !== null) ticketPriceMap.set(attraction.id, amount);
    }
    // Filter out attractions that alone exceed the total budget ceiling.
    filtered = filtered.filter((a) => {
      const price = ticketPriceMap.get(a.id);
      // Keep if no verified price (we can't exclude what we don't know)
      // or if price is within budget
      return price === undefined || price <= overrides.budgetCeilingPerPerson!;
    });
  }

  return filtered.sort((a, b) => {
    // Crowd avoidance scoring (for responsible routing)
    if (overrides?.crowdAvoidanceWeight) {
      const crowdRankMap: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };
      const crowdA = crowdRankMap[a.crowdRecords[0]?.currentCrowdLevel ?? 'LOW'] ?? 0;
      const crowdB = crowdRankMap[b.crowdRecords[0]?.currentCrowdLevel ?? 'LOW'] ?? 0;
      const crowdDiff = (crowdA - crowdB) * overrides.crowdAvoidanceWeight;
      if (Math.abs(crowdDiff) > 0.5) return crowdDiff > 0 ? 1 : -1;
    }

    // Interest-based scoring
    const interestScoreA = interests.size === 0 ? 0 : a.categories.filter((category) => interests.has(category.toLowerCase())).length;
    const interestScoreB = interests.size === 0 ? 0 : b.categories.filter((category) => interests.has(category.toLowerCase())).length;
    if (interestScoreA !== interestScoreB) return interestScoreB - interestScoreA;

    // Budget preference: cheaper first when budget ceiling is set
    if (overrides?.budgetCeilingPerPerson !== undefined) {
      const priceA = ticketPriceMap.get(a.id) ?? Infinity;
      const priceB = ticketPriceMap.get(b.id) ?? Infinity;
      if (priceA !== priceB) return priceA - priceB;
    }

    return (idOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (idOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  });
};

// ─── Main Itinerary Generation ───────────────────────────────────────────────

/**
 * Core deterministic itinerary generation.
 * Used by both POST /generate and POST /trips/:id/itinerary/replan.
 * The LLM is NEVER involved here — only deterministic constraint solving.
 */
export async function generateItinerary(
  input: PlannerInput,
  overrides?: PlannerOverrides,
): Promise<PlanResult> {
  const warnings: string[] = [];
  const excluded: Exclusion[] = [];
  const tripStart = new Date(input.startDate);
  const effectiveDays = overrides?.daysOverride ?? input.days;
  const effectiveDayEnd = overrides?.dayEndOverride ?? DAY_END;
  const indoorOnlyDays = new Set(overrides?.indoorOnlyDays ?? []);
  const budgetCeiling = overrides?.budgetCeilingPerPerson;
  let budgetSpentPerPerson = 0;

  const candidates = await sortCandidates(
    input,
    warnings,
    overrides ? { ...overrides, indoorOnly: Boolean(overrides.indoorOnly && indoorOnlyDays.size === 0) } : undefined,
  );

  if (candidates.length === 0) {
    throw new AppError('No matching attractions found for these preferences', 404, 'NO_ATTRACTIONS');
  }

  const itineraryItems: ItineraryItem[] = [];
  const maxItemsPerDay = paceLimit(input.preferences.pace);
  const usedCandidateIds = new Set<string>();
  const excludedCandidateIds = new Set<string>();

  for (let day = 1; day <= effectiveDays; day++) {
    let currentMinutes = timeToMinutes(DAY_START);
    let itemsToday = 0;
    let lastLocation: { latitude: number; longitude: number } | null = null;
    const indoorOnlyToday = Boolean(overrides?.indoorOnly && (indoorOnlyDays.size === 0 || indoorOnlyDays.has(day)));

    while (itemsToday < maxItemsPerDay) {
      let scheduled = false;

      for (const candidate of candidates) {
        if (usedCandidateIds.has(candidate.id) || excludedCandidateIds.has(candidate.id)) continue;
        if (indoorOnlyToday && candidate.indoorOutdoor !== 'indoor' && candidate.indoorOutdoor !== 'mixed') continue;

        const exclusion = exclusionFor(candidate, tripStart, overrides);
        if (exclusion) {
          excluded.push(exclusion);
          excludedCandidateIds.add(candidate.id);
          continue;
        }

        const candidatePrice = verifiedTicketPrice(candidate.facts) ?? 0;
        if (budgetCeiling !== undefined && budgetSpentPerPerson + candidatePrice > budgetCeiling) continue;

        const slot = await canSchedule(candidate, currentMinutes, lastLocation, input, effectiveDayEnd);
        if (!slot) continue;

        const trustSummary = buildTrustSummary(candidate, slot.itemWarnings);

        itineraryItems.push({
          dayNumber: day,
          sequence: itemsToday + 1,
          entityType: 'attraction',
          entityId: candidate.id,
          attractionName: candidate.name,
          startTime: minutesToTime(slot.startMinutes),
          endTime: minutesToTime(slot.endMinutes),
          travelBufferMinutesBefore: slot.transitionMinutes,
          factIds: trustSummary.facts.map((fact) => fact.fact_id),
          trustSummary,
        });

        currentMinutes = slot.endMinutes;
        lastLocation = { latitude: candidate.latitude, longitude: candidate.longitude };
        usedCandidateIds.add(candidate.id);
        budgetSpentPerPerson += candidatePrice;
        itemsToday++;
        scheduled = true;
        break;
      }

      if (!scheduled) break;
    }
  }

  if (itineraryItems.length === 0) {
    warnings.push('No attractions could be scheduled within the selected constraints');
  }

  return {
    destinationId: input.destinationId,
    days: effectiveDays,
    itineraryItems,
    excluded,
    warnings,
  };
}
