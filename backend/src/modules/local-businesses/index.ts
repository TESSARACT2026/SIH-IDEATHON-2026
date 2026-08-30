import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';

const router = Router();

const querySchema = z.object({
  destinationId: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(100).optional(),
  locallyOwned: z.enum(['true', 'false']).optional(),
  search: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

router.get('/', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const destinationId = query.destinationId ? resolveDestinationId(query.destinationId) : undefined;

    const businesses = await prisma.localBusiness.findMany({
      where: {
        ...(destinationId ? { destinationId } : {}),
        ...(query.category ? { category: { contains: query.category, mode: 'insensitive' } } : {}),
        ...(query.locallyOwned ? { isLocallyOwned: query.locallyOwned === 'true' } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
      include: {
        destination: { select: { id: true, name: true, region: true, country: true } },
        ownershipSource: { select: { id: true, name: true, sourceType: true, url: true } },
      },
      orderBy: { name: 'asc' },
      take: query.limit,
    });

    res.json({
      data: businesses.map((business) => ({
        id: business.id,
        name: business.name,
        category: business.category,
        latitude: business.latitude,
        longitude: business.longitude,
        destinationId: business.destinationId,
        destination: business.destination,
        isLocallyOwned: business.isLocallyOwned,
        ownershipSource: business.ownershipSource,
        description: business.description,
      })),
      meta: {
        count: businesses.length,
        limit: query.limit,
        ...(destinationId ? { destinationId } : {}),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid local business query', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

export default router;
