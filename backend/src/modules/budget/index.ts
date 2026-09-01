import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { resolveAttractionId, resolveDestinationId } from '../../shared/utils/idAliases.js';

const router = Router();

const trustedStatuses = new Set(['VERIFIED', 'LIVE']);

const querySchema = z.object({
  travellerType: z.enum(['INDIAN', 'FOREIGN', 'CHILD']).default('INDIAN'),
  travellers: z.coerce.number().int().min(1).max(20).default(1),
}).strict();

const destinationParamSchema = z.object({
  id: z.string().min(1).max(100),
}).strict();

const tripParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

const estimateSchema = z.object({
  attractionIds: z.array(z.string().min(1).max(100)).min(1).max(50),
  travellerType: z.enum(['INDIAN', 'FOREIGN', 'CHILD']).default('INDIAN'),
  travellers: z.number().int().min(1).max(20).default(1),
}).strict();

type PriceFact = Prisma.FactGetPayload<{
  include: {
    source: { select: { id: true; name: true; sourceType: true; reliabilityTier: true; url: true } };
  };
}>;

type BudgetAttraction = Prisma.AttractionGetPayload<{
  include: {
    facts: {
      include: {
        source: { select: { id: true; name: true; sourceType: true; reliabilityTier: true; url: true } };
      };
    };
  };
}>;

type BudgetBandName = 'BUDGET' | 'MODERATE' | 'PREMIUM';
type TransportPreferenceName = 'WALKING' | 'PUBLIC_TRANSIT' | 'CAB' | 'OWN_VEHICLE' | 'MIXED';

const approximateVisitCostByDestination: Record<string, number> = {
  agartala: 4200,
  agra: 5200,
  ahmedabad: 5000,
  aizwal: 5600,
  aizawl: 5600,
  amritsar: 4800,
  bengaluru: 6500,
  bhopal: 4600,
  'bodh gaya': 4300,
  bhubaneswar: 2200,
  chandigarh: 5000,
  chennai: 5600,
  daman: 5200,
  darjeeling: 6800,
  dehradun: 5400,
  gangtok: 7200,
  goa: 8500,
  gurugram: 6200,
  guwahati: 5200,
  hyderabad: 5600,
  imphal: 5600,
  jaipur: 5800,
  kavaratti: 12000,
  kerala: 7800,
  kohima: 5800,
  kolkata: 5200,
  konark: 2800,
  leh: 9500,
  manali: 7800,
  mumbai: 7000,
  munnar: 7200,
  mysore: 5000,
  'new delhi': 6200,
  pondicherry: 5200,
  'port blair': 9000,
  puri: 3200,
  raipur: 4300,
  ranchi: 4200,
  shillong: 6200,
  srinagar: 7600,
  tawang: 8500,
  varanasi: 4600,
  visakhapatnam: 4800,
};

function approximateVisitCost(
  destinationName: string,
  travellerType: 'INDIAN' | 'FOREIGN' | 'CHILD',
) {
  const base = approximateVisitCostByDestination[destinationName.trim().toLowerCase()] ?? 4500;
  if (travellerType === 'FOREIGN') return Math.round(base * 1.6);
  if (travellerType === 'CHILD') return Math.round(base * 0.65);
  return base;
}

function approximateAttractionAmount(
  destinationName: string,
  travellerType: 'INDIAN' | 'FOREIGN' | 'CHILD',
  attractionCount: number,
) {
  if (!destinationName) return 80;
  const amount = approximateVisitCost(destinationName, travellerType) / Math.max(1, attractionCount);
  return Math.max(50, Math.round(amount / 50) * 50);
}

function numberFrom(value: Prisma.JsonValue, key: string): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function stringFrom(value: Prisma.JsonValue, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function objectValue(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function priceFor(fact: PriceFact, travellerType: 'INDIAN' | 'FOREIGN' | 'CHILD') {
  const key = travellerType === 'FOREIGN' ? 'foreign_nationals' : travellerType === 'CHILD' ? 'children' : 'amount';
  return numberFrom(fact.factValue, key) ?? numberFrom(fact.factValue, 'amount');
}

function sourceFor(fact: PriceFact) {
  return {
    id: fact.source.id,
    name: fact.source.name,
    sourceType: fact.source.sourceType,
    reliabilityTier: fact.source.reliabilityTier,
    url: fact.source.url,
  };
}

function buildBudget(
  attractions: BudgetAttraction[],
  travellerType: 'INDIAN' | 'FOREIGN' | 'CHILD',
  travellers: number,
  destinationName = '',
) {
  const approximateAmount = approximateAttractionAmount(destinationName, travellerType, attractions.length);
  const lineItems = attractions.map((attraction) => {
    const priceFacts = attraction.facts.filter((fact) => fact.factKey === 'ticket_price');
    const selectedFact =
      priceFacts.find((fact) => trustedStatuses.has(fact.verificationStatus)) ??
      priceFacts[0] ??
      null;

    const amount = selectedFact && trustedStatuses.has(selectedFact.verificationStatus)
      ? priceFor(selectedFact, travellerType)
      : null;
    const estimatedAmount = amount ?? approximateAmount;

    return {
      attractionId: attraction.id,
      attractionName: attraction.name,
      amountPerTraveller: estimatedAmount,
      travellers,
      totalAmount: estimatedAmount * travellers,
      currency: amount === null ? 'INR' : stringFrom(selectedFact!.factValue, 'currency') ?? 'INR',
      verificationStatus: amount === null ? 'INFERRED' : selectedFact?.verificationStatus ?? 'VERIFIED',
      source: selectedFact ? sourceFor(selectedFact) : null,
      note: amount === null ? 'Approximate ticket estimate; no verified price available' : null,
    };
  });

  const included = lineItems.filter((item) => item.totalAmount !== null);
  const unverified = lineItems.filter((item) => item.totalAmount === null);
  const ticketTotal = included.reduce((sum, item) => sum + item.totalAmount!, 0);
  const destinationEstimate = destinationName
    ? approximateVisitCost(destinationName, travellerType) * travellers
    : 0;

  return {
    currency: 'INR',
    travellerType,
    travellers,
    totalAmount: Math.max(ticketTotal, destinationEstimate),
    includedCount: included.length,
    unverifiedCount: unverified.length,
    lineItems,
    warnings: unverified.map((item) => `${item.attractionName}: ${item.note}`),
  };
}

function roundTo50(value: number) {
  return Math.round(value / 50) * 50;
}

export function ticketTotalPerTravellerFromSnapshot(snapshot: Prisma.JsonValue | null | undefined) {
  const plan = objectValue(snapshot);
  const items = arrayValue(plan?.itineraryItems ?? plan?.items);

  return items.reduce((sum, item) => {
    const trust = objectValue(item.trustSummary as Prisma.JsonValue);
    const facts = arrayValue(trust?.facts);
    const price = facts.find((fact) => (
      (fact.fact_key === 'ticket_price' || fact.factKey === 'ticket_price') &&
      trustedStatuses.has(textValue(fact.verification_status ?? fact.verificationStatus) ?? '')
    ));
    const factValue = objectValue((price?.fact_value ?? price?.factValue) as Prisma.JsonValue);
    return sum + (numberValue(factValue?.amount) ?? 0);
  }, 0);
}

export function transparentBudgetBreakdown(input: {
  days: number;
  travellers: number;
  travellerType: 'INDIAN' | 'FOREIGN' | 'CHILD';
  ticketTotalPerTraveller: number;
  stopCount: number;
  budgetBand?: BudgetBandName | null;
  transportPreference?: TransportPreferenceName | null;
}) {
  const days = Math.max(1, input.days);
  const travellers = Math.max(1, input.travellers);
  const budgetBand = input.budgetBand ?? 'MODERATE';
  const transportPreference = input.transportPreference ?? 'MIXED';
  const foodPerTravellerPerDay: Record<BudgetBandName, number> = { BUDGET: 500, MODERATE: 850, PREMIUM: 1400 };
  const localExperiencePerStop: Record<BudgetBandName, number> = { BUDGET: 150, MODERATE: 250, PREMIUM: 450 };
  const transportPerDay: Record<TransportPreferenceName, number> = {
    WALKING: 100,
    PUBLIC_TRANSIT: 250,
    CAB: 900,
    OWN_VEHICLE: 700,
    MIXED: 450,
  };
  const sharedTransport = transportPreference === 'CAB' || transportPreference === 'OWN_VEHICLE';
  const entryTickets = input.ticketTotalPerTraveller * travellers;
  const transportation = roundTo50(transportPerDay[transportPreference] * days * (sharedTransport ? 1 : travellers));
  const food = roundTo50(foodPerTravellerPerDay[budgetBand] * days * travellers);
  const localExperiences = roundTo50(localExperiencePerStop[budgetBand] * Math.max(1, input.stopCount) * travellers);
  const subtotal = entryTickets + transportation + food + localExperiences;
  const buffer = roundTo50(subtotal * 0.12);
  const totalAmount = subtotal + buffer;

  return {
    currency: 'INR',
    travellerType: input.travellerType,
    travellers,
    days,
    budgetBand,
    transportPreference,
    totalAmount,
    perTravellerAmount: Math.ceil(totalAmount / travellers),
    breakdown: [
      { category: 'TRANSPORTATION', label: 'Transportation', amount: transportation, confidence: 'INFERRED' },
      { category: 'ENTRY_TICKETS', label: 'Entry tickets', amount: entryTickets, confidence: entryTickets > 0 ? 'VERIFIED_OR_LIVE' : 'INFERRED' },
      { category: 'FOOD', label: 'Food', amount: food, confidence: 'INFERRED' },
      { category: 'LOCAL_EXPERIENCES', label: 'Local experiences', amount: localExperiences, confidence: 'INFERRED' },
      { category: 'BUFFER', label: 'Buffer', amount: buffer, confidence: 'INFERRED' },
    ],
    assumptions: [
      'Entry tickets use verified/live ticket_price facts saved in the itinerary snapshot.',
      'Food, transport, local experiences, and buffer are deterministic India travel estimates.',
    ],
  };
}

async function findAttractions(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.map(resolveAttractionId)));
  return prisma.attraction.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      facts: {
        where: { entityType: 'attraction', factKey: 'ticket_price' },
        include: { source: { select: { id: true, name: true, sourceType: true, reliabilityTier: true, url: true } } },
        orderBy: [{ lastChecked: 'desc' }, { timestamp: 'desc' }],
      },
    },
    orderBy: { name: 'asc' },
  });
}

router.get('/destinations/:id', async (req, res, next) => {
  try {
    const { id: rawId } = destinationParamSchema.parse(req.params);
    const query = querySchema.parse(req.query);
    const id = resolveDestinationId(rawId);

    const destination = await prisma.destination.findUnique({
      where: { id },
      select: { id: true, name: true, region: true, country: true },
    });

    if (!destination) {
      throw new AppError('Destination not found', 404, 'DESTINATION_NOT_FOUND');
    }

    const attractions = await prisma.attraction.findMany({
      where: { destinationId: id },
      include: {
        facts: {
          where: { entityType: 'attraction', factKey: 'ticket_price' },
          include: { source: { select: { id: true, name: true, sourceType: true, reliabilityTier: true, url: true } } },
          orderBy: [{ lastChecked: 'desc' }, { timestamp: 'desc' }],
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      data: {
        destination,
        ...buildBudget(attractions, query.travellerType, query.travellers, destination.name),
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid destination budget request', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

router.post('/estimate', async (req, res, next) => {
  try {
    const payload = estimateSchema.parse(req.body);
    const attractions = await findAttractions(payload.attractionIds);

    if (attractions.length !== new Set(payload.attractionIds.map(resolveAttractionId)).size) {
      throw new AppError('One or more attractions were not found', 404, 'ATTRACTION_NOT_FOUND');
    }

    res.json({ data: buildBudget(attractions, payload.travellerType, payload.travellers) });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid budget estimate payload', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

router.get('/trips/:id/breakdown', requireAuth, async (req, res, next) => {
  try {
    const { id } = tripParamSchema.parse(req.params);
    const query = querySchema.parse(req.query);
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        destination: { select: { id: true, name: true, region: true, country: true } },
        user: {
          select: {
            preferences: { select: { budgetBand: true, transportPreference: true } },
          },
        },
      },
    });

    if (!trip || trip.userId !== req.user!.userId) {
      throw new AppError('Trip not found', 404, 'NOT_FOUND');
    }
    if (!trip.itinerarySnapshot) {
      throw new AppError('Trip has no saved itinerary snapshot for budget breakdown', 409, 'ITINERARY_NOT_READY');
    }

    const plan = objectValue(trip.itinerarySnapshot);
    const plannerInput = objectValue(trip.plannerInput);
    const plannerPreferences = objectValue(plannerInput?.preferences as Prisma.JsonValue);
    const stopCount = arrayValue(plan?.itineraryItems ?? plan?.items).length;
    const days = numberValue(plan?.days) ?? Math.max(1, Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / 86_400_000));
    const transportPreference = textValue(plannerPreferences?.transportPreference) as TransportPreferenceName | null;
    const breakdown = transparentBudgetBreakdown({
      days,
      travellers: query.travellers,
      travellerType: query.travellerType,
      ticketTotalPerTraveller: ticketTotalPerTravellerFromSnapshot(trip.itinerarySnapshot),
      stopCount,
      budgetBand: trip.user.preferences?.budgetBand,
      transportPreference: transportPreference ?? trip.user.preferences?.transportPreference,
    });

    res.json({
      data: {
        trip: {
          id: trip.id,
          title: trip.title,
          destination: trip.destination,
          startDate: trip.startDate.toISOString(),
          endDate: trip.endDate.toISOString(),
        },
        ...breakdown,
        budgetReductionAction: {
          label: 'Reduce budget by INR 1000 per person',
          method: 'POST',
          path: `/api/v1/trips/${trip.id}/itinerary/replan`,
          payload: { delta: { type: 'budget_change', payload: { decreaseByPerPerson: 1000 } } },
        },
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trip budget request', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

export default router;
