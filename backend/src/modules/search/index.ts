import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  type: z.enum(['all', 'destination', 'attraction']).default('all'),
  limit: z.coerce.number().int().min(1).max(20).default(10),
}).strict();

router.get('/', async (req, res, next) => {
  try {
    const { q, type, limit } = searchQuerySchema.parse(req.query);
    const perTypeLimit = type === 'all' ? limit : limit;

    const [destinations, attractions] = await Promise.all([
      type === 'attraction'
        ? Promise.resolve([])
        : prisma.destination.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { region: { contains: q, mode: 'insensitive' } },
                { country: { contains: q, mode: 'insensitive' } },
              ],
            },
            orderBy: { name: 'asc' },
            take: perTypeLimit,
          }),
      type === 'destination'
        ? Promise.resolve([])
        : prisma.attraction.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { destination: { name: { contains: q, mode: 'insensitive' } } },
              ],
            },
            include: {
              destination: { select: { id: true, name: true, region: true, country: true } },
            },
            orderBy: { name: 'asc' },
            take: perTypeLimit,
          }),
    ]);

    const results = [
      ...destinations.map((destination) => ({
        type: 'destination' as const,
        id: destination.id,
        title: destination.name,
        subtitle: [destination.region, destination.country].filter(Boolean).join(', '),
        latitude: destination.latitude,
        longitude: destination.longitude,
      })),
      ...attractions.map((attraction) => ({
        type: 'attraction' as const,
        id: attraction.id,
        title: attraction.name,
        subtitle: attraction.destination.name,
        destinationId: attraction.destinationId,
        destination: attraction.destination,
        categories: attraction.categories,
        latitude: attraction.latitude,
        longitude: attraction.longitude,
        address: attraction.address,
      })),
    ].slice(0, limit);

    res.json({ data: results, meta: { q, type, count: results.length } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid search query', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

export default router;
