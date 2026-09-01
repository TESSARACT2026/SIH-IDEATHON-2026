import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
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

export default router;
