import { describe, expect, it } from 'vitest';
import {
  estimateWalkingMinutes,
  walkingSuitabilityReason,
  weatherSuitabilityReason,
} from '../src/modules/attractions/suitability.js';

const outdoorAttraction = {
  indoorOutdoor: 'outdoor',
  categories: ['Heritage', 'Fort'],
  accessibilityNotes: 'Steep walk and uneven stone steps.',
};

describe('attraction suitability helpers', () => {
  it('rejects outdoor attractions during hot afternoon weather', () => {
    const reason = weatherSuitabilityReason(
      { indoorOutdoor: 'outdoor' },
      { time: '14:00' },
      { condition: 'clear', temperatureC: 38, source: 'test' },
    );

    expect(reason.passed).toBe(false);
    expect(reason.detail).toContain('outdoor exposure');
  });

  it('keeps indoor attractions suitable during rain', () => {
    const reason = weatherSuitabilityReason(
      { indoorOutdoor: 'indoor' },
      { time: '14:00' },
      { condition: 'rain', temperatureC: 28, source: 'test' },
    );

    expect(reason.passed).toBe(true);
    expect(reason.detail).toContain('Indoor');
  });

  it('uses walking tolerance against deterministic walking estimate', () => {
    expect(estimateWalkingMinutes(outdoorAttraction)).toBe(65);

    const reason = walkingSuitabilityReason(outdoorAttraction, 30);
    expect(reason.passed).toBe(false);
    expect(reason.detail).toContain('exceeds 30 min tolerance');
  });
});
