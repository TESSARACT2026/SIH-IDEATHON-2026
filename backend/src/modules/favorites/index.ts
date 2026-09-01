import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { resolveAttractionId, resolveDestinationId } from '../../shared/utils/idAliases.js';

const router = Router();

// All favorites routes require authentication
router.use(requireAuth);

const destinationSelect = {
  id: true,
  name: true,
  country: true,
  region: true,
  latitude: true,
  longitude: true,
  timezone: true,
} as const;

const attractionSelect = {
  id: true,
  name: true,
  categories: true,
  latitude: true,
  longitude: true,
  address: true,
  description: true,
  indoorOutdoor: true,
  accessibilityWheelchair: true,
  accessibilityVisual: true,
  accessibilityHearing: true,
  accessibilityNotes: true,
  destinationId: true,
} as const;

const addFavoriteSchema = z.object({
  attractionId: z.string().min(1).max(100).optional(),
  destinationId: z.string().min(1).max(100).optional(),
}).strict().refine((data) => !!data.attractionId !== !!data.destinationId, {
  message: 'Provide exactly one of attractionId or destinationId',
});

const attractionParamSchema = z.object({
  attractionId: z.string().min(1).max(100),
}).strict();

const destinationParamSchema = z.object({
  destinationId: z.string().min(1).max(100),
}).strict();

// GET /api/v1/favorites — list user's favorites
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        destination: { select: destinationSelect },
        attraction: { select: attractionSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: {
        destinations: favorites
          .filter((f) => f.destination)
          .map((f) => ({
            id: f.id,
            destinationId: f.destinationId,
            createdAt: f.createdAt.toISOString(),
            destination: f.destination,
          })),
        attractions: favorites
          .filter((f) => f.attraction)
          .map((f) => ({
            id: f.id,
            attractionId: f.attractionId,
            createdAt: f.createdAt.toISOString(),
            attraction: f.attraction,
          })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/favorites — add a favorite
router.post('/', async (req, res, next) => {
  try {
    const payload = addFavoriteSchema.parse(req.body);
    const userId = req.user!.userId;

    if (payload.destinationId) {
      const destinationId = resolveDestinationId(payload.destinationId);
      const destination = await prisma.destination.findUnique({ where: { id: destinationId } });
      if (!destination) throw new AppError('Destination not found', 404, 'NOT_FOUND');

      const favorite = await prisma.favorite.upsert({
        where: {
          userId_destinationId: { userId, destinationId },
        },
        create: { userId, destinationId },
        update: {},
        include: { destination: { select: destinationSelect } },
      });

      res.status(201).json({
        data: {
          id: favorite.id,
          destinationId: favorite.destinationId,
          createdAt: favorite.createdAt.toISOString(),
          destination: favorite.destination,
        },
      });
      return;
    }

    const attractionId = resolveAttractionId(payload.attractionId!);
    const attraction = await prisma.attraction.findUnique({ where: { id: attractionId } });
    if (!attraction) throw new AppError('Attraction not found', 404, 'NOT_FOUND');

    // Upsert to avoid duplicate errors
    const favorite = await prisma.favorite.upsert({
      where: {
        userId_attractionId: { userId, attractionId },
      },
      create: { userId, attractionId },
      update: {}, // no-op if already exists
      include: { attraction: { select: attractionSelect } },
    });

    res.status(201).json({
      data: {
        id: favorite.id,
        attractionId: favorite.attractionId,
        createdAt: favorite.createdAt.toISOString(),
        attraction: favorite.attraction,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    next(err);
  }
});

// DELETE /api/v1/favorites/destinations/:destinationId — remove a destination favorite
router.delete('/destinations/:destinationId', async (req, res, next) => {
  try {
    const { destinationId: rawDestinationId } = destinationParamSchema.parse(req.params);
    const destinationId = resolveDestinationId(rawDestinationId);
    const userId = req.user!.userId;

    await prisma.favorite.deleteMany({
      where: { userId, destinationId },
    });

    res.json({ data: { success: true, message: 'Destination favorite removed' } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid destination ID',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    next(err);
  }
});

// DELETE /api/v1/favorites/:attractionId — remove an attraction favorite
router.delete('/:attractionId', async (req, res, next) => {
  try {
    const { attractionId: rawAttractionId } = attractionParamSchema.parse(req.params);
    const attractionId = resolveAttractionId(rawAttractionId);
    const userId = req.user!.userId;

    await prisma.favorite.deleteMany({
      where: { userId, attractionId },
    });

    res.json({ data: { success: true, message: 'Favorite removed' } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid attraction ID',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    next(err);
  }
});

export default router;
