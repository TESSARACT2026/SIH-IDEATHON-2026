import { Router } from 'express';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { requireAuth } from '../../shared/middleware/auth.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { globalLimiter } from '../../shared/middleware/rateLimiter.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';
import { emergencyContactBundle } from '../emergency/index.js';

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const createTripSchema = z.object({
  destinationId: z.string().min(1).max(100),
  title: z.string().min(1).max(200).default('My Trip'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(['DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED']).default('DRAFT'),
}).strict();

const updateTripSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED']).optional(),
  isPublic: z.boolean().optional(),
}).strict();

const saveSnapshotSchema = z.object({
  itinerarySnapshot: z.record(z.unknown()),
  plannerInput: z.record(z.unknown()).optional(),
}).strict();

const uuidParamSchema = z.object({
  id: z.string().uuid(),
}).strict();

const shareTokenParamSchema = z.object({
  token: z.string().min(8).max(128),
}).strict();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateShareToken(): string {
  // 32 bytes = 64 hex chars — cryptographically unguessable
  return randomBytes(32).toString('hex');
}

function tripToPublic(trip: any) {
  // Strip all owner-identifying fields for public share view
  return {
    id: trip.id,
    title: trip.title,
    destinationId: trip.destinationId,
    destination: trip.destination,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    itinerarySnapshot: trip.itinerarySnapshot,
    createdAt: trip.createdAt.toISOString(),
    // NOTE: userId, user email, shareToken are deliberately excluded
  };
}

function assertValidTripDates(startDate: Date, endDate: Date): void {
  if (endDate <= startDate) {
    throw new AppError('End date must be after start date', 400, 'INVALID_DATES');
  }
}

function pdfEscape(value: string): string {
  return value.replace(/[\\()]/g, '\\$&').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function wrapLine(value: string, max = 86): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= max) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  return line ? [...lines, line] : [''];
}

function createTextPdf(lines: string[]): Buffer {
  const pageLines = lines.flatMap((line) => wrapLine(line));
  const pages = Array.from({ length: Math.max(1, Math.ceil(pageLines.length / 48)) }, (_, index) =>
    pageLines.slice(index * 48, index * 48 + 48)
  );
  const fontObject = 3 + pages.length * 2;
  const objects: string[] = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
  ];

  for (let index = 0; index < pages.length; index++) {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const body = [
      'BT',
      '/F1 12 Tf',
      '14 TL',
      '50 790 Td',
      ...pages[index].map((line) => `(${pdfEscape(line)}) Tj T*`),
      'ET',
    ].join('\n');
    const stream = `${body}\n`;

    objects.push(`${pageObject} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>\nendobj\n`);
    objects.push(`${contentObject} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`);
  }

  objects.push(`${fontObject} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
}

function objectValue(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function exportFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${slug || 'trip'}-itinerary.pdf`;
}

function offlinePackFileName(title: string): string {
  return exportFileName(title).replace('-itinerary.pdf', '-offline-pack.json');
}

function snapshotItems(snapshot: Prisma.JsonValue | null | undefined): Record<string, unknown>[] {
  const plan = objectValue(snapshot);
  return arrayValue(plan?.itineraryItems ?? plan?.items);
}

function itineraryLinesFromSnapshot(snapshot: Prisma.JsonValue | null | undefined): string[] {
  const items = snapshotItems(snapshot);
  if (items.length === 0) return ['No itinerary items saved yet.'];

  return items.flatMap((item) => {
    const day = item.dayNumber ?? item.day;
    const attraction = textValue(item.attractionName) ?? textValue(item.name) ?? textValue(item.entityId) ?? 'Stop';
    const time = [textValue(item.startTime), textValue(item.endTime)].filter(Boolean).join(' - ');
    const note = textValue(item.explanationText) ?? textValue(item.description);
    
    // Survival Info extraction
    const trust = objectValue(item.trustSummary as Prisma.JsonValue);
    const facts = arrayValue(trust?.facts);
    
    let survivalInfo = '';
    if (facts.length > 0) {
      const parts = [];
      const price = facts.find(f => f.fact_key === 'ticket_price');
      if (price) {
        const val = objectValue(price.fact_value as Prisma.JsonValue);
        if (val && typeof val.amount === 'number') {
          parts.push(`Price: ${val.amount === 0 ? 'Free' : `${val.amount} ${val.currency || 'INR'}`}`);
        }
      }
      
      const hours = facts.find(f => f.fact_key === 'opening_hours');
      if (hours && typeof hours.fact_value === 'string') {
        parts.push(`Hours: ${hours.fact_value}`);
      }
      
      if (parts.length > 0) {
        survivalInfo = `  [Survival Info] ${parts.join(' | ')}`;
      }
    }

    return [
      `Day ${typeof day === 'number' ? day : '?'}: ${time ? `${time} - ` : ''}${attraction}`,
      ...(note ? [`  ${note}`] : []),
      ...(survivalInfo ? [survivalInfo] : []),
    ];
  });
}

function buildTripPdf(trip: {
  title: string;
  startDate: Date;
  endDate: Date;
  destination: { name: string; region: string | null; country: string };
  itinerarySnapshot: Prisma.JsonValue | null;
}): Buffer {
  const destination = [trip.destination.name, trip.destination.region, trip.destination.country].filter(Boolean).join(', ');
  
  const plan = objectValue(trip.itinerarySnapshot);
  const warnings = stringArrayValue(plan?.warnings);
  
  const lines = [
    trip.title,
    `Destination: ${destination}`,
    `Dates: ${trip.startDate.toISOString().slice(0, 10)} to ${trip.endDate.toISOString().slice(0, 10)}`,
    '',
  ];

  if (warnings && warnings.length > 0) {
    lines.push('--- OFFLINE SURVIVAL WARNINGS ---');
    warnings.forEach(w => lines.push(`! ${w}`));
    lines.push('---------------------------------');
    lines.push('');
  }

  lines.push('Itinerary');
  lines.push(...itineraryLinesFromSnapshot(trip.itinerarySnapshot));

  return createTextPdf(lines);
}

function sendTripPdf(res: import('express').Response, trip: {
  title: string;
  startDate: Date;
  endDate: Date;
  destination: { name: string; region: string | null; country: string };
  itinerarySnapshot: Prisma.JsonValue | null;
}) {
  if (!trip.itinerarySnapshot) {
    throw new AppError('Trip has no saved itinerary snapshot to export', 409, 'ITINERARY_NOT_READY');
  }

  const pdf = buildTripPdf(trip);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${exportFileName(trip.title)}"`);
  res.setHeader('Content-Length', pdf.length.toString());
  res.send(pdf);
}

type OfflinePackTrip = {
  id: string;
  title: string;
  destinationId: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  itinerarySnapshot: Prisma.JsonValue | null;
  destination: {
    id: string;
    name: string;
    region: string | null;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  user: {
    preferredLanguage: string;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
  itineraries: {
    generatedAt: Date;
    items: {
      dayNumber: number;
      sequence: number;
      startTime: string;
      endTime: string;
      entityId: string;
      travelBufferMinutesBefore: number;
      attraction: {
        id: string;
        name: string;
        categories: string[];
        latitude: number;
        longitude: number;
        address: string | null;
        accessibilityWheelchair: boolean;
        accessibilityVisual: boolean;
        accessibilityHearing: boolean;
        accessibilityNotes: string | null;
      } | null;
    }[];
  }[];
};

function factsForSnapshotItem(item: Record<string, unknown>) {
  const trust = objectValue(item.trustSummary as Prisma.JsonValue);
  return arrayValue(trust?.facts).map((fact) => ({
    id: textValue(fact.fact_id ?? fact.id),
    factKey: textValue(fact.fact_key ?? fact.factKey) ?? 'unknown',
    factValue: fact.fact_value ?? fact.factValue ?? null,
    sourceName: textValue(fact.source_name ?? fact.sourceName),
    sourceType: textValue(fact.source_type ?? fact.sourceType),
    verificationStatus: textValue(fact.verification_status ?? fact.verificationStatus),
    confidence: numberValue(fact.confidence),
    lastChecked: textValue(fact.last_checked ?? fact.lastChecked ?? fact.timestamp),
  }));
}

export function importantFactsFromSnapshot(snapshot: Prisma.JsonValue | null | undefined) {
  const facts = new Map<string, ReturnType<typeof factsForSnapshotItem>[number] & { stopName: string }>();

  for (const item of snapshotItems(snapshot)) {
    const stopName = textValue(item.attractionName) ?? textValue(item.name) ?? textValue(item.entityId) ?? 'Stop';
    for (const fact of factsForSnapshotItem(item)) {
      const key = fact.id ?? `${stopName}:${fact.factKey}:${JSON.stringify(fact.factValue)}`;
      if (!facts.has(key)) facts.set(key, { ...fact, stopName });
    }
  }

  return Array.from(facts.values());
}

export function buildOfflinePack(trip: OfflinePackTrip) {
  const snapshot = objectValue(trip.itinerarySnapshot);
  const persistedItems = new Map((trip.itineraries[0]?.items ?? []).map((item) => [item.entityId, item]));
  const itinerary = snapshotItems(trip.itinerarySnapshot).map((item, index) => {
    const entityId = textValue(item.entityId);
    const persisted = entityId ? persistedItems.get(entityId) : undefined;
    const attraction = persisted?.attraction;

    return {
      dayNumber: numberValue(item.dayNumber ?? item.day) ?? persisted?.dayNumber ?? null,
      sequence: numberValue(item.sequence) ?? persisted?.sequence ?? index + 1,
      startTime: textValue(item.startTime) ?? persisted?.startTime ?? null,
      endTime: textValue(item.endTime) ?? persisted?.endTime ?? null,
      travelBufferMinutesBefore: numberValue(item.travelBufferMinutesBefore) ?? persisted?.travelBufferMinutesBefore ?? 0,
      attraction: {
        id: entityId ?? persisted?.entityId ?? null,
        name: textValue(item.attractionName) ?? textValue(item.name) ?? attraction?.name ?? 'Stop',
        address: attraction?.address ?? null,
        categories: attraction?.categories ?? [],
        latitude: attraction?.latitude ?? null,
        longitude: attraction?.longitude ?? null,
        accessibility: {
          wheelchair: attraction?.accessibilityWheelchair ?? false,
          visual: attraction?.accessibilityVisual ?? false,
          hearing: attraction?.accessibilityHearing ?? false,
          notes: attraction?.accessibilityNotes ?? null,
        },
      },
      facts: factsForSnapshotItem(item),
      note: textValue(item.explanationText) ?? textValue(item.description),
    };
  });
  const importantFacts = importantFactsFromSnapshot(trip.itinerarySnapshot);
  const emergency = emergencyContactBundle(trip.destination);
  const savedContacts = trip.user.emergencyContactPhone
    ? [{
        category: 'personal',
        label: trip.user.emergencyContactName ?? 'Emergency contact',
        phone: trip.user.emergencyContactPhone,
      }]
    : [];
  const warnings = stringArrayValue(snapshot?.warnings);
  const alternatives = arrayValue(snapshot?.excluded).map((item) => ({
    entityId: textValue(item.entityId),
    attractionName: textValue(item.attractionName) ?? textValue(item.name) ?? 'Alternative',
    reason: textValue(item.reason) ?? 'Excluded by trip constraints',
    verificationStatus: textValue(item.verificationStatus),
  }));

  return {
    formatVersion: '1.0',
    generatedAt: new Date().toISOString(),
    trip: {
      id: trip.id,
      title: trip.title,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate.toISOString(),
      snapshotUpdatedAt: trip.updatedAt.toISOString(),
    },
    destination: trip.destination,
    itinerary,
    mapHints: {
      destinationCenter: {
        latitude: trip.destination.latitude,
        longitude: trip.destination.longitude,
      },
      stops: itinerary.map((item) => ({
        name: item.attraction.name,
        latitude: item.attraction.latitude,
        longitude: item.attraction.longitude,
      })),
      routeSegments: itinerary.slice(1).map((item, index) => ({
        from: itinerary[index].attraction.name,
        to: item.attraction.name,
        estimatedMinutes: item.travelBufferMinutesBefore,
      })),
    },
    importantFacts,
    emergency: {
      contacts: emergency.contacts,
      lastVerified: emergency.lastVerified,
    },
    savedContacts,
    languagePack: {
      locale: trip.user.preferredLanguage,
      phrases: [
        { key: 'need_help', en: 'I need help.', hi: 'Mujhe madad chahiye.', or: 'Mote sahajya darkar.' },
        { key: 'call_emergency', en: 'Please call emergency services.', hi: 'Kripya emergency service ko call kijiye.', or: 'Emergency seva ku call karantu.' },
        { key: 'lost', en: 'I am lost.', hi: 'Main raasta bhatak gaya/gayi hoon.', or: 'Mu raasta bhuli jaichi.' },
      ],
    },
    warnings,
    alternatives,
    verification: {
      factCount: importantFacts.length,
      lastVerifiedTimestamps: Array.from(new Set(importantFacts.map((fact) => fact.lastChecked).filter(Boolean))),
      emergencyLastVerified: emergency.lastVerified,
    },
  };
}

// ─── Public Share Route (Feature 2) ─────────────────────────────────────────
// GET /api/v1/trips/share/:token — NO AUTH REQUIRED, rate-limited
// Returns only trips with is_public=true and matching share_token
// NEVER leaks owner email/userId

router.get('/share/:token/export', globalLimiter, async (req, res, next) => {
  try {
    const { token } = shareTokenParamSchema.parse(req.params);
    const trip = await prisma.trip.findUnique({
      where: { shareToken: token },
      include: { destination: { select: { name: true, region: true, country: true } } },
    });

    if (!trip || !trip.isPublic) {
      throw new AppError('Shared trip not found or is no longer public', 404, 'NOT_FOUND');
    }

    sendTripPdf(res, trip);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid share token', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

router.get('/share/:token', globalLimiter, async (req, res, next) => {
  try {
    const { token } = shareTokenParamSchema.parse(req.params);

    const trip = await prisma.trip.findUnique({
      where: { shareToken: token },
      include: {
        destination: {
          select: { id: true, name: true, region: true, country: true, latitude: true, longitude: true },
        },
      },
    });

    if (!trip || !trip.isPublic) {
      throw new AppError('Shared trip not found or is no longer public', 404, 'NOT_FOUND');
    }

    res.json({ data: tripToPublic(trip) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid share token', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

// ─── Authenticated Routes ────────────────────────────────────────────────────

router.get('/:id/export', requireAuth, async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const userId = req.user!.userId;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { destination: { select: { name: true, region: true, country: true } } },
    });

    if (!trip || trip.userId !== userId) throw new AppError('Trip not found', 404, 'NOT_FOUND');

    sendTripPdf(res, trip);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trip ID', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

router.get('/:id/offline-pack', requireAuth, async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const userId = req.user!.userId;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        destination: {
          select: { id: true, name: true, region: true, country: true, latitude: true, longitude: true, timezone: true },
        },
        user: {
          select: { preferredLanguage: true, emergencyContactName: true, emergencyContactPhone: true },
        },
        itineraries: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          include: {
            items: {
              orderBy: [{ dayNumber: 'asc' }, { sequence: 'asc' }],
              include: {
                attraction: {
                  select: {
                    id: true,
                    name: true,
                    categories: true,
                    latitude: true,
                    longitude: true,
                    address: true,
                    accessibilityWheelchair: true,
                    accessibilityVisual: true,
                    accessibilityHearing: true,
                    accessibilityNotes: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!trip || trip.userId !== userId) throw new AppError('Trip not found', 404, 'NOT_FOUND');
    if (!trip.itinerarySnapshot) throw new AppError('Trip has no saved itinerary snapshot for offline pack', 409, 'ITINERARY_NOT_READY');

    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('Content-Disposition', `attachment; filename="${offlinePackFileName(trip.title)}"`);
    res.json({ data: buildOfflinePack(trip) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trip ID', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

// GET /api/v1/trips — list user's trips
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const trips = await prisma.trip.findMany({
      where: { userId },
      include: {
        destination: {
          select: { id: true, name: true, region: true, country: true },
        },
        itineraries: {
          select: { id: true, generatedAt: true, validated: true },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { startDate: 'asc' },
    });

    res.json({
      data: trips.map((trip) => ({
        id: trip.id,
        title: trip.title,
        destinationId: trip.destinationId,
        destination: trip.destination,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        status: trip.status,
        isPublic: trip.isPublic,
        shareToken: trip.isPublic ? trip.shareToken : null, // only expose token if public
        hasSnapshot: trip.itinerarySnapshot !== null,
        hasItinerary: trip.itineraries.length > 0,
        createdAt: trip.createdAt.toISOString(),
        updatedAt: trip.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/trips/:id — get trip details with itinerary
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const userId = req.user!.userId;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        destination: true,
        itineraries: {
          include: {
            items: {
              include: {
                attraction: {
                  select: { id: true, name: true, categories: true, latitude: true, longitude: true },
                },
              },
              orderBy: [{ dayNumber: 'asc' }, { sequence: 'asc' }],
            },
          },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!trip) throw new AppError('Trip not found', 404, 'NOT_FOUND');

    // Ownership check — service-role key bypasses RLS, so we enforce in code
    if (trip.userId !== userId) throw new AppError('Trip not found', 404, 'NOT_FOUND');

    res.json({
      data: {
        ...trip,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        shareToken: trip.isPublic ? trip.shareToken : null,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trip ID', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

// POST /api/v1/trips — create a new trip
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { destinationId: rawDestinationId, title, startDate, endDate, status } = createTripSchema.parse(req.body);
    const destinationId = resolveDestinationId(rawDestinationId);
    const userId = req.user!.userId;

    const destination = await prisma.destination.findUnique({ where: { id: destinationId } });
    if (!destination) throw new AppError('Destination not found', 404, 'NOT_FOUND');

    const tripStart = new Date(startDate);
    const tripEnd = new Date(endDate);
    assertValidTripDates(tripStart, tripEnd);

    const trip = await prisma.trip.create({
      data: { userId, destinationId, title, startDate: tripStart, endDate: tripEnd, status },
      include: {
        destination: { select: { id: true, name: true, region: true, country: true } },
      },
    });

    res.status(201).json({
      data: {
        id: trip.id,
        title: trip.title,
        destinationId: trip.destinationId,
        destination: trip.destination,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        status: trip.status,
        isPublic: trip.isPublic,
        shareToken: null,
        createdAt: trip.createdAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trip data', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

// PATCH /api/v1/trips/:id — update trip metadata (title, dates, status, isPublic)
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const updates = updateTripSchema.parse(req.body);
    const userId = req.user!.userId;

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new AppError('Trip not found', 404, 'NOT_FOUND');

    const nextStartDate = updates.startDate ? new Date(updates.startDate) : existing.startDate;
    const nextEndDate = updates.endDate ? new Date(updates.endDate) : existing.endDate;
    assertValidTripDates(nextStartDate, nextEndDate);

    const data: Record<string, unknown> = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.startDate) data.startDate = nextStartDate;
    if (updates.endDate) data.endDate = nextEndDate;
    if (updates.status) data.status = updates.status;

    // Handle sharing: public trips must always have a token; private trips must not.
    if (updates.isPublic === true) {
      data.isPublic = true;
      if (!existing.shareToken) data.shareToken = generateShareToken();
    } else if (updates.isPublic === false && existing.isPublic) {
      data.isPublic = false;
      data.shareToken = null;
    }

    const trip = await prisma.trip.update({ where: { id }, data });

    res.json({
      data: {
        id: trip.id,
        title: trip.title,
        status: trip.status,
        isPublic: trip.isPublic,
        shareToken: trip.isPublic ? trip.shareToken : null,
        shareUrl: trip.isPublic && trip.shareToken
          ? `/share/${trip.shareToken}`
          : null,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        updatedAt: trip.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid update data', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

// POST /api/v1/trips/:id/snapshot — save generated itinerary into the trip (freeze it)
router.post('/:id/snapshot', requireAuth, async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const { itinerarySnapshot, plannerInput } = saveSnapshotSchema.parse(req.body);
    const userId = req.user!.userId;

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new AppError('Trip not found', 404, 'NOT_FOUND');

    const snapshotPlannerInput = objectValue(itinerarySnapshot as Prisma.JsonValue)?.plannerInput;
    const data: Prisma.TripUpdateInput = {
      itinerarySnapshot: itinerarySnapshot as Prisma.InputJsonValue,
    };
    if (plannerInput || snapshotPlannerInput) {
      data.plannerInput = (plannerInput ?? snapshotPlannerInput) as Prisma.InputJsonValue;
    }

    const trip = await prisma.trip.update({
      where: { id },
      data,
    });

    res.json({
      data: {
        id: trip.id,
        hasSnapshot: trip.itinerarySnapshot !== null,
        updatedAt: trip.updatedAt.toISOString(),
        message: 'Itinerary snapshot saved. Facts are frozen at this version. Use "Verify Facts" to check if they are still current.',
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid snapshot data', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

// DELETE /api/v1/trips/:id — delete trip
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const userId = req.user!.userId;

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new AppError('Trip not found', 404, 'NOT_FOUND');

    await prisma.trip.delete({ where: { id } });

    res.json({ data: { success: true, message: 'Trip deleted' } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid trip ID', details: err.flatten().fieldErrors } });
      return;
    }
    next(err);
  }
});

export default router;
