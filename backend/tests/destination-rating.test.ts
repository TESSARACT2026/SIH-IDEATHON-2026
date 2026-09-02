import { describe, expect, it } from 'vitest';
import { rateDestination, type DestinationRatingInput, type RateableDestination } from '../src/modules/scoring/destination-rating.js';

const baseInput: DestinationRatingInput = {
  startDate: '2026-09-05T09:00:00.000Z',
  preferredTime: '09:00',
  days: 2,
  pace: 'MODERATE',
  accessibilityWheelchair: false,
  accessibilityVision: false,
  accessibilityHearing: false,
  accessibilityCognitive: false,
  interests: [],
  transportPreference: 'MIXED',
  budgetBand: 'MODERATE',
};

const destination = (overrides: Partial<RateableDestination>): RateableDestination => ({
  id: 'dest-1',
  name: 'Bhubaneswar',
  region: 'Odisha',
  country: 'India',
  latitude: 20.2961,
  longitude: 85.8245,
  timezone: 'Asia/Kolkata',
  attractions: [
    {
      id: 'museum',
      name: 'Odisha State Museum',
      categories: ['Museums', 'Culture'],
      latitude: 20.268,
      longitude: 85.841,
      indoorOutdoor: 'indoor',
      accessibilityWheelchair: true,
      accessibilityVisual: true,
      accessibilityHearing: true,
      facts: [{ factKey: 'ticket_price', verificationStatus: 'VERIFIED', factValue: { amount: 50 } }],
    },
  ],
  ...overrides,
});

describe('destination fit rating', () => {
  it('penalizes destinations that do not meet wheelchair needs', () => {
    const accessible = destination({});
    const inaccessible = destination({
      attractions: accessible.attractions.map((attraction) => ({ ...attraction, accessibilityWheelchair: false })),
    });
    const input = { ...baseInput, accessibilityWheelchair: true };

    expect(rateDestination(accessible, input).score).toBeGreaterThan(rateDestination(inaccessible, input).score);
  });

  it('scores cheaper destinations higher for budget travellers', () => {
    const cheap = destination({});
    const expensive = destination({
      attractions: cheap.attractions.map((attraction) => ({
        ...attraction,
        facts: [{ factKey: 'ticket_price', verificationStatus: 'LIVE', factValue: { amount: 1200 } }],
      })),
    });
    const input = { ...baseInput, budgetBand: 'BUDGET' as const };

    expect(rateDestination(cheap, input).score).toBeGreaterThan(rateDestination(expensive, input).score);
  });

  it('rewards destinations matching selected interests', () => {
    const museumCity = destination({});
    const natureCity = destination({
      attractions: museumCity.attractions.map((attraction) => ({
        ...attraction,
        name: 'Hill View Trail',
        categories: ['Nature', 'Adventure'],
      })),
    });
    const input = { ...baseInput, interests: ['Museums & Culture'] };

    expect(rateDestination(museumCity, input).score).toBeGreaterThan(rateDestination(natureCity, input).score);
  });

  it('lowers hot afternoon ratings for outdoor-heavy destinations', () => {
    const outdoorCity = destination({
      region: 'Rajasthan',
      name: 'Jaipur',
      attractions: [
        {
          ...destination({}).attractions[0],
          id: 'fort',
          name: 'Amber Fort',
          categories: ['Heritage', 'Fort'],
          indoorOutdoor: 'outdoor',
        },
      ],
    });
    const morning = rateDestination(outdoorCity, { ...baseInput, startDate: '2026-05-20T09:00:00.000Z', preferredTime: '09:00' });
    const afternoon = rateDestination(outdoorCity, { ...baseInput, startDate: '2026-05-20T14:00:00.000Z', preferredTime: '14:00' });

    expect(morning.score).toBeGreaterThan(afternoon.score);
  });
});
