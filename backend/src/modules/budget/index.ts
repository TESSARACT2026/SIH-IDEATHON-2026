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

function buildBudget(attractions: BudgetAttraction[], travellerType: 'INDIAN' | 'FOREIGN' | 'CHILD', travellers: number) {
  const lineItems = attractions.map((attraction) => {
    const priceFacts = attraction.facts.filter((fact) => fact.factKey === 'ticket_price');
    const selectedFact =
      priceFacts.find((fact) => trustedStatuses.has(fact.verificationStatus)) ??
      priceFacts[0] ??
      null;

    const amount = selectedFact && trustedStatuses.has(selectedFact.verificationStatus)
      ? priceFor(selectedFact, travellerType)
      : null;

    return {
      attractionId: attraction.id,
      attractionName: attraction.name,
      amountPerTraveller: amount,
      travellers,
      totalAmount: amount === null ? null : amount * travellers,
      currency: selectedFact ? stringFrom(selectedFact.factValue, 'currency') ?? 'INR' : null,
      verificationStatus: selectedFact?.verificationStatus ?? 'UNVERIFIED',
      source: selectedFact ? sourceFor(selectedFact) : null,
      note:
        !selectedFact
          ? 'No ticket price fact found'
          : !trustedStatuses.has(selectedFact.verificationStatus)
            ? 'Ticket price is not verified; excluded from total'
            : amount === null
              ? 'Ticket price amount is not numeric; excluded from total'
              : null,
    };
  });

  const included = lineItems.filter((item) => item.totalAmount !== null);
  const unverified = lineItems.filter((item) => item.totalAmount === null);

  return {
    currency: 'INR',
    travellerType,
    travellers,
    totalAmount: included.reduce((sum, item) => sum + item.totalAmount!, 0),
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
        ...buildBudget(attractions, query.travellerType, query.travellers),
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
