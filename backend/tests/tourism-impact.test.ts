import { describe, expect, it } from 'vitest';
import { localBusinessProximityScore } from '../src/modules/planner/engine.js';
import {
  distanceKm,
  planTravelDistanceKm,
  tourismImpactSummary,
} from '../src/modules/scoring/tourism-impact.js';

describe('tourism impact helpers', () => {
  it('counts locally owned business proximity around an attraction', () => {
    expect(localBusinessProximityScore(
      { latitude: 20, longitude: 85 },
      [
        { latitude: 20.001, longitude: 85.001 },
        { latitude: 21, longitude: 86 },
      ],
    )).toBe(1);
  });

  it('calculates route distance from itinerary order', () => {
    const distance = planTravelDistanceKm({
      itineraryItems: [
        { entityId: 'a' },
        { entityId: 'b' },
      ],
    } as any, new Map([
      ['a', { latitude: 0, longitude: 0 }],
      ['b', { latitude: 0, longitude: 1 }],
    ]));

    expect(distance).toBeCloseTo(111.2, 1);
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeGreaterThan(111);
  });

  it('rewards lower crowd, shorter travel, fewer sensitivity flags, and local support', () => {
    const responsible = tourismImpactSummary({
      itemCount: 4,
      highCrowdStops: 0,
      localBusinessStops: 3,
      travelDistanceKm: 8,
      environmentalSensitivityFlags: 0,
      culturalSensitivityFlags: 0,
    });
    const popular = tourismImpactSummary({
      itemCount: 4,
      highCrowdStops: 2,
      localBusinessStops: 0,
      travelDistanceKm: 35,
      environmentalSensitivityFlags: 1,
      culturalSensitivityFlags: 1,
    });

    expect(responsible.impactScore).toBeGreaterThan(popular.impactScore);
    expect(popular.environmentalImpact).toBe('High');
  });
});
