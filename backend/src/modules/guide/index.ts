import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { resolveAttractionId, resolveDestinationId } from '../../shared/utils/idAliases.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().min(1).max(100),
}).strict();

const trustedStatuses = new Set(['VERIFIED', 'LIVE']);
const essentialFactKeys = ['opening_hours', 'ticket_price', 'accessibility', 'entry_restrictions'];

type GuideAttraction = Prisma.AttractionGetPayload<{
  include: {
    destination: { select: { id: true; name: true; region: true; country: true; timezone: true } };
    facts: {
      include: {
        source: { select: { id: true; name: true; sourceType: true; reliabilityTier: true; url: true } };
      };
    };
    crowdRecords: { take: 1; orderBy: { timestamp: 'desc' }; include: { source: true } };
    sensitivityFlags: { include: { source: true } };
  };
}>;

type AttractionGuideResponse = ReturnType<typeof toAttractionGuide>;

function toFact(fact: GuideAttraction['facts'][number]) {
  return {
    id: fact.id,
    key: fact.factKey,
    value: fact.factValue,
    verificationStatus: fact.verificationStatus,
    confidence: fact.confidence,
    lastChecked: fact.lastChecked.toISOString(),
    source: {
      id: fact.source.id,
      name: fact.source.name,
      sourceType: fact.source.sourceType,
      reliabilityTier: fact.source.reliabilityTier,
      url: fact.source.url,
    },
  };
}

function toAttractionGuide(attraction: GuideAttraction) {
  const facts = attraction.facts.map(toFact);
  const latestCrowd = attraction.crowdRecords[0] ?? null;
  const missingTrustedEssentials = essentialFactKeys.filter((key) => {
    return !attraction.facts.some((fact) => fact.factKey === key && trustedStatuses.has(fact.verificationStatus));
  });

  return {
    id: attraction.id,
    destinationId: attraction.destinationId,
    destination: attraction.destination,
    name: attraction.name,
    categories: attraction.categories,
    latitude: attraction.latitude,
    longitude: attraction.longitude,
    address: attraction.address,
    description: attraction.description,
    indoorOutdoor: attraction.indoorOutdoor,
    accessibility: {
      wheelchair: attraction.accessibilityWheelchair,
      visual: attraction.accessibilityVisual,
      hearing: attraction.accessibilityHearing,
      notes: attraction.accessibilityNotes,
    },
    facts,
    latestCrowd: latestCrowd
      ? {
          id: latestCrowd.id,
          currentCrowdLevel: latestCrowd.currentCrowdLevel,
          capacityValue: latestCrowd.capacityValue,
          verificationStatus: latestCrowd.verificationStatus,
          timestamp: latestCrowd.timestamp.toISOString(),
          source: latestCrowd.source
            ? {
                id: latestCrowd.source.id,
                name: latestCrowd.source.name,
                sourceType: latestCrowd.source.sourceType,
              }
            : null,
        }
      : null,
    sensitivityFlags: attraction.sensitivityFlags.map((flag) => ({
      id: flag.id,
      sensitivityType: flag.sensitivityType,
      description: flag.description,
      activeFrom: flag.activeFrom?.toISOString() ?? null,
      activeTo: flag.activeTo?.toISOString() ?? null,
      source: flag.source
        ? {
            id: flag.source.id,
            name: flag.source.name,
            sourceType: flag.source.sourceType,
          }
        : null,
    })),
    trustWarnings: missingTrustedEssentials.map((key) => `${key} is not backed by a VERIFIED or LIVE fact`),
  };
}

const attractionInclude = {
  destination: { select: { id: true, name: true, region: true, country: true, timezone: true } },
  facts: {
    include: { source: { select: { id: true, name: true, sourceType: true, reliabilityTier: true, url: true } } },
    orderBy: [{ factKey: 'asc' as const }, { lastChecked: 'desc' as const }],
  },
  crowdRecords: { orderBy: { timestamp: 'desc' as const }, take: 1, include: { source: true } },
  sensitivityFlags: { include: { source: true } },
};

const minAttractionCards = 6;
const supplementalAttractionLabels = [
  'Heritage Walk',
  'Local Market Trail',
  'Cultural Museum Stop',
  'Food Street',
  'City Viewpoint',
] as const;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function supplementalAttractions(
  destination: { id: string; name: string; region: string | null; country: string; latitude: number; longitude: number; timezone: string },
  existing: AttractionGuideResponse[],
) {
  const names = new Set(existing.map((attraction) => attraction.name.toLowerCase()));
  const needed = Math.max(0, minAttractionCards - existing.length);

  return supplementalAttractionLabels
    .map((label, index) => ({
      id: `${destination.id}-suggested-${slug(label)}`,
      destinationId: destination.id,
      destination: {
        id: destination.id,
        name: destination.name,
        region: destination.region,
        country: destination.country,
        timezone: destination.timezone,
      },
      name: `${destination.name} ${label}`,
      categories: index === 1 ? ['Local Food & Markets'] : ['Tourism', 'Culture'],
      latitude: destination.latitude + index * 0.005,
      longitude: destination.longitude + index * 0.005,
      address: [destination.name, destination.region, destination.country].filter(Boolean).join(', '),
      description: `Suggested stop to round out a short ${destination.name} itinerary.`,
      indoorOutdoor: index === 2 ? 'indoor' : 'outdoor',
      accessibility: { wheelchair: false, visual: false, hearing: true, notes: null },
      facts: [],
      latestCrowd: null,
      sensitivityFlags: [],
      trustWarnings: ['Suggested fallback attraction; not yet verified in backend records'],
    }))
    .filter((attraction) => !names.has(attraction.name.toLowerCase()))
    .slice(0, needed);
}

router.get('/destinations/:id', async (req, res, next) => {
  try {
    const { id: rawId } = idParamSchema.parse(req.params);
    const id = resolveDestinationId(rawId);

    const destination = await prisma.destination.findUnique({
      where: { id },
      include: {
        attractions: {
          include: attractionInclude,
          orderBy: { name: 'asc' },
        },
        localBusinesses: {
          include: {
            ownershipSource: { select: { id: true, name: true, sourceType: true, url: true } },
          },
          orderBy: { name: 'asc' },
          take: 10,
        },
      },
    });

    if (!destination) {
      throw new AppError('Destination not found', 404, 'DESTINATION_NOT_FOUND');
    }

    const attractions = destination.attractions.map(toAttractionGuide);
    const displayAttractions = [
      ...attractions,
      ...supplementalAttractions(destination, attractions),
    ];

    res.json({
      data: {
        id: destination.id,
        name: destination.name,
        country: destination.country,
        region: destination.region,
        latitude: destination.latitude,
        longitude: destination.longitude,
        timezone: destination.timezone,
        attractions: displayAttractions,
        localBusinesses: destination.localBusinesses.map((business) => ({
          id: business.id,
          name: business.name,
          category: business.category,
          latitude: business.latitude,
          longitude: business.longitude,
          isLocallyOwned: business.isLocallyOwned,
          description: business.description,
          ownershipSource: business.ownershipSource,
        })),
      },
      meta: {
        attractionCount: displayAttractions.length,
        localBusinessCount: destination.localBusinesses.length,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid destination guide request' } });
      return;
    }
    next(err);
  }
});

router.get('/attractions/:id', async (req, res, next) => {
  try {
    const { id: rawId } = idParamSchema.parse(req.params);
    const id = resolveAttractionId(rawId);

    const attraction = await prisma.attraction.findUnique({
      where: { id },
      include: attractionInclude,
    });

    if (!attraction) {
      throw new AppError('Attraction not found', 404, 'ATTRACTION_NOT_FOUND');
    }

    res.json({ data: toAttractionGuide(attraction) });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid attraction guide request' } });
      return;
    }
    next(err);
  }
});

export default router;
