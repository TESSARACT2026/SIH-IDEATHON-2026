import { describe, expect, it } from 'vitest';
import { restorePlannerInputForReplan } from '../src/modules/planner/replan.js';
import type { PlannerInput } from '../src/modules/planner/engine.js';

const fallback: PlannerInput = {
  destinationId: 'trip-destination',
  startDate: '2026-09-03T09:00:00.000Z',
  endDate: '2026-09-04T18:00:00.000Z',
  days: 2,
  preferences: {
    pace: 'MODERATE',
    accessibilityWheelchair: false,
    accessibilityVision: false,
    accessibilityHearing: false,
    accessibilityCognitive: false,
    interests: [],
    transportPreference: 'MIXED',
  },
};

describe('restorePlannerInputForReplan', () => {
  it('keeps stored preferences while using current trip metadata', () => {
    const restored = restorePlannerInputForReplan({
      destinationId: 'old-destination',
      startDate: '2026-01-01T09:00:00.000Z',
      endDate: '2026-01-02T18:00:00.000Z',
      days: 1,
      saveTrip: true,
      preferences: {
        pace: 'PACKED',
        accessibilityWheelchair: true,
        accessibilityVision: false,
        accessibilityHearing: true,
        accessibilityCognitive: false,
        interests: ['Heritage'],
        transportPreference: 'WALKING',
        groupType: 'FAMILY',
        walkingToleranceMinutes: 15,
        indoorOutdoorPreference: 'indoor',
        localBusinessPreference: true,
      },
    }, fallback);

    expect(restored.destinationId).toBe('trip-destination');
    expect(restored.startDate).toBe('2026-09-03T09:00:00.000Z');
    expect(restored.days).toBe(2);
    expect(restored.saveTrip).toBe(false);
    expect(restored.preferences).toMatchObject({
      pace: 'PACKED',
      accessibilityWheelchair: true,
      transportPreference: 'WALKING',
      interests: ['Heritage'],
      walkingToleranceMinutes: 15,
    });
  });

  it('falls back for old trips without planner memory', () => {
    expect(restorePlannerInputForReplan(null, fallback)).toBe(fallback);
  });
});
