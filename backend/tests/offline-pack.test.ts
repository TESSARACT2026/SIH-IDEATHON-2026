import { describe, expect, it } from 'vitest';
import { buildOfflinePack, importantFactsFromSnapshot } from '../src/modules/trips/index.js';

const snapshot = {
  warnings: ['Carry cash for local transport'],
  itineraryItems: [
    {
      dayNumber: 1,
      sequence: 1,
      entityId: 'attr-1',
      attractionName: 'Museum',
      startTime: '09:00',
      endTime: '11:00',
      travelBufferMinutesBefore: 0,
      trustSummary: {
        facts: [
          {
            fact_id: 'fact-1',
            fact_key: 'opening_hours',
            fact_value: '09:00-17:00',
            source_name: 'Tourism Board',
            verification_status: 'VERIFIED',
            last_checked: '2026-09-01T00:00:00.000Z',
          },
        ],
      },
    },
  ],
  excluded: [{ entityId: 'attr-2', attractionName: 'Fort', reason: 'Too far today' }],
};

describe('offline pack helpers', () => {
  it('extracts important facts from the saved snapshot', () => {
    expect(importantFactsFromSnapshot(snapshot as any)).toEqual([
      expect.objectContaining({
        id: 'fact-1',
        factKey: 'opening_hours',
        factValue: '09:00-17:00',
        stopName: 'Museum',
      }),
    ]);
  });

  it('builds an offline pack with itinerary, contacts, map hints, and alternatives', () => {
    const pack = buildOfflinePack({
      id: 'trip-1',
      title: 'Offline Trip',
      destinationId: 'dest-1',
      startDate: new Date('2026-09-03T09:00:00.000Z'),
      endDate: new Date('2026-09-04T18:00:00.000Z'),
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
      itinerarySnapshot: snapshot as any,
      destination: {
        id: 'dest-1',
        name: 'Bhubaneswar',
        region: 'Odisha',
        country: 'India',
        latitude: 20.2961,
        longitude: 85.8245,
        timezone: 'Asia/Kolkata',
      },
      user: {
        preferredLanguage: 'hi',
        emergencyContactName: 'Home',
        emergencyContactPhone: '+911234567890',
      },
      itineraries: [{
        generatedAt: new Date('2026-09-02T00:00:00.000Z'),
        items: [{
          dayNumber: 1,
          sequence: 1,
          startTime: '09:00',
          endTime: '11:00',
          entityId: 'attr-1',
          travelBufferMinutesBefore: 0,
          attraction: {
            id: 'attr-1',
            name: 'Museum',
            categories: ['Museum'],
            latitude: 20.1,
            longitude: 85.8,
            address: 'Central Road',
            accessibilityWheelchair: true,
            accessibilityVisual: false,
            accessibilityHearing: false,
            accessibilityNotes: null,
          },
        }],
      }],
    });

    expect(pack.itinerary[0].attraction.latitude).toBe(20.1);
    expect(pack.savedContacts).toEqual([{ category: 'personal', label: 'Home', phone: '+911234567890' }]);
    expect(pack.emergency.contacts.length).toBeGreaterThan(1);
    expect(pack.alternatives[0]).toMatchObject({ attractionName: 'Fort', reason: 'Too far today' });
  });
});
