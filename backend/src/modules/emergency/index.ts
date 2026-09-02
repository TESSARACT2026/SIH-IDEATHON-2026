import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import { resolveDestinationId } from '../../shared/utils/idAliases.js';

const router = Router();

export type EmergencyContact = {
  category: string;
  label: string;
  phone: string;
  available24x7: boolean;
  description: string;
  sourceName: string;
  sourceUrl: string;
};

const querySchema = z.object({
  destinationId: z.string().min(1).max(100).optional(),
  countryCode: z.string().length(2).default('IN').transform((code) => code.toUpperCase()),
}).strict();

const nationalContacts: EmergencyContact[] = [
  {
    category: 'emergency',
    label: 'National emergency number',
    phone: '112',
    available24x7: true,
    description: 'Integrated emergency response for police, fire, ambulance, and other urgent assistance.',
    sourceName: 'Emergency Response Support System, Government of India',
    sourceUrl: 'https://112.gov.in/',
  },
  {
    category: 'tourist',
    label: 'Tourist helpline',
    phone: '1363',
    available24x7: true,
    description: 'Tourist helpline for visitors in India.',
    sourceName: 'Incredible India',
    sourceUrl: 'https://www.incredibleindia.gov.in/en/emergency',
  },
  {
    category: 'police',
    label: 'Police',
    phone: '100',
    available24x7: true,
    description: 'Police assistance.',
    sourceName: 'National Portal of India',
    sourceUrl: 'https://www.india.gov.in/directory/helpline',
  },
  {
    category: 'fire',
    label: 'Fire',
    phone: '101',
    available24x7: true,
    description: 'Fire emergency assistance.',
    sourceName: 'National Portal of India',
    sourceUrl: 'https://www.india.gov.in/directory/helpline',
  },
  {
    category: 'ambulance',
    label: 'Ambulance',
    phone: '102',
    available24x7: true,
    description: 'National ambulance service.',
    sourceName: 'National Portal of India',
    sourceUrl: 'https://www.india.gov.in/directory/helpline',
  },
  {
    category: 'cyber',
    label: 'Cyber crime helpline',
    phone: '1930',
    available24x7: true,
    description: 'Cyber crime reporting helpline.',
    sourceName: 'National Portal of India',
    sourceUrl: 'https://www.india.gov.in/directory/helpline',
  },
  {
    category: 'railway',
    label: 'Railway helpline',
    phone: '139',
    available24x7: true,
    description: 'Railway enquiry, security, and medical assistance.',
    sourceName: 'National Portal of India',
    sourceUrl: 'https://www.india.gov.in/directory/helpline',
  },
];

const regionalContacts: Record<string, EmergencyContact[]> = {
  Odisha: [
    {
      category: 'traffic',
      label: 'Traffic control',
      phone: '1095',
      available24x7: true,
      description: 'Odisha traffic control helpline.',
      sourceName: 'Odisha Police',
      sourceUrl: 'https://police.odisha.gov.in/',
    },
    {
      category: 'women',
      label: 'Women helpline',
      phone: '181',
      available24x7: true,
      description: 'Women in distress helpline.',
      sourceName: 'Odisha Police',
      sourceUrl: 'https://police.odisha.gov.in/',
    },
    {
      category: 'transport',
      label: 'OSRTC travellers helpline',
      phone: '1800 345 1122',
      available24x7: false,
      description: 'Odisha State Road Transport Corporation bus traveller helpline.',
      sourceName: 'Government of Odisha',
      sourceUrl: 'https://odisha.gov.in/en/contacts/emergency',
    },
    {
      category: 'tourist',
      label: 'Tourist Officer, Puri',
      phone: '06752-222664',
      available24x7: false,
      description: 'Tourist office contact for Puri.',
      sourceName: 'Government of Odisha',
      sourceUrl: 'https://odisha.gov.in/en/contacts/emergency',
    },
  ],
  Rajasthan: [
    {
      category: 'traffic',
      label: 'Traffic police',
      phone: '1095',
      available24x7: true,
      description: 'Rajasthan traffic police helpline.',
      sourceName: 'Rajasthan Police',
      sourceUrl: 'https://police.rajasthan.gov.in/portal/EmergencyContacts',
    },
    {
      category: 'women_senior',
      label: 'Women and senior citizen helpline',
      phone: '1090',
      available24x7: true,
      description: 'Rajasthan women and senior citizen assistance.',
      sourceName: 'Rajasthan Police',
      sourceUrl: 'https://police.rajasthan.gov.in/portal/EmergencyContacts',
    },
    {
      category: 'ambulance',
      label: 'Ambulance',
      phone: '102/112',
      available24x7: true,
      description: 'Rajasthan ambulance emergency contact.',
      sourceName: 'Rajasthan Police',
      sourceUrl: 'https://police.rajasthan.gov.in/portal/EmergencyContacts',
    },
  ],
};

export function emergencyContactBundle(destination?: { region: string | null } | null) {
  const regional = destination?.region ? regionalContacts[destination.region] ?? [] : [];
  return {
    contacts: [...nationalContacts, ...regional],
    regionalCount: regional.length,
    lastVerified: '2026-08-31',
  };
}

router.get('/', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    if (query.countryCode !== 'IN') {
      throw new AppError('Only India emergency contacts are supported', 400, 'UNSUPPORTED_COUNTRY');
    }

    const destinationId = query.destinationId ? resolveDestinationId(query.destinationId) : undefined;
    const destination = destinationId
      ? await prisma.destination.findUnique({
          where: { id: destinationId },
          select: { id: true, name: true, region: true, country: true },
        })
      : null;

    if (destinationId && !destination) {
      throw new AppError('Destination not found', 404, 'DESTINATION_NOT_FOUND');
    }

    const bundle = emergencyContactBundle(destination);

    res.json({
      data: {
        countryCode: 'IN',
        destination,
        contacts: bundle.contacts,
        lastVerified: bundle.lastVerified,
      },
      meta: {
        count: bundle.contacts.length,
        sources: Array.from(new Set(bundle.contacts.map((contact) => contact.sourceUrl))),
      },
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid emergency contacts query',
          details: err.flatten().fieldErrors,
        },
      });
      return;
    }
    next(err);
  }
});

export default router;
