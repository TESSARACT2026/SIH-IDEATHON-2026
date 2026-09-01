import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';

const router = Router();

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(100).default(10),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  destinationId: z.string().min(1).max(100).optional(),
}).strict();

type NearbyRow = {
  id: string;
  destinationId: string;
  name: string;
  categories: string[];
  latitude: number;
  longitude: number;
  address: string | null;
  description: string | null;
  indoorOutdoor: string;
  accessibilityWheelchair: boolean;
  accessibilityVisual: boolean;
  accessibilityHearing: boolean;
  accessibilityNotes: string | null;
  destinationName: string;
  destinationRegion: string | null;
  destinationCountry: string;
  distanceMeters: number;
};

router.get('/', async (req, res, next) => {
  try {
    const query = nearbyQuerySchema.parse(req.query);
    const destinationId = query.destinationId ? resolveDestinationId(query.destinationId) : undefined;
    const radiusMeters = query.radiusKm * 1000;
    const destinationFilter = destinationId ? Prisma.sql`AND a.destination_id = ${destinationId}` : Prisma.empty;

    const rows = await prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      SELECT
        a.id,
        a.destination_id AS "destinationId",
        a.name,
        a.categories,
        a.latitude,
        a.longitude,
        a.address,
        a.description,
        a.indoor_outdoor AS "indoorOutdoor",
        a.accessibility_wheelchair AS "accessibilityWheelchair",
        a.accessibility_visual AS "accessibilityVisual",
        a.accessibility_hearing AS "accessibilityHearing",
        a.accessibility_notes AS "accessibilityNotes",
        d.name AS "destinationName",
        d.region AS "destinationRegion",
        d.country AS "destinationCountry",
        ST_Distance(
          ST_MakePoint(a.longitude, a.latitude)::geography,
          ST_MakePoint(${query.lon}, ${query.lat})::geography
        ) AS "distanceMeters"
      FROM attractions a
      JOIN destinations d ON d.id = a.destination_id
      WHERE ST_DWithin(
        ST_MakePoint(a.longitude, a.latitude)::geography,
        ST_MakePoint(${query.lon}, ${query.lat})::geography,
        ${radiusMeters}
      )
      ${destinationFilter}
      ORDER BY "distanceMeters" ASC
      LIMIT ${query.limit}
    `);

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        destinationId: row.destinationId,
        name: row.name,
        categories: row.categories,
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        description: row.description,
        indoorOutdoor: row.indoorOutdoor,
        accessibilityWheelchair: row.accessibilityWheelchair,
        accessibilityVisual: row.accessibilityVisual,
        accessibilityHearing: row.accessibilityHearing,
        accessibilityNotes: row.accessibilityNotes,
        destination: {
          id: row.destinationId,
          name: row.destinationName,
          region: row.destinationRegion,
          country: row.destinationCountry,
        },
        distanceKm: Math.round((Number(row.distanceMeters) / 1000) * 100) / 100,
      })),
      meta: {
        lat: query.lat,
        lon: query.lon,
        radiusKm: query.radiusKm,
        limit: query.limit,
        ...(destinationId ? { destinationId } : {}),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid nearby query', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

export default router;
