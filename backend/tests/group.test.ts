import { describe, expect, it } from 'vitest';
import { blendPreferences } from '../src/modules/group/index.js';

describe('group preference blending', () => {
  it('keeps strictest constraints and blends interests by vote share', () => {
    const result = blendPreferences([
      {
        name: 'Asha',
        submittedAt: '2026-09-02T09:00:00.000Z',
        preferences: {
          pace: 'PACKED',
          accessibilityWheelchair: false,
          accessibilityVision: false,
          accessibilityHearing: false,
          accessibilityCognitive: false,
          interests: ['Heritage', 'Food'],
          transportPreference: 'WALKING',
          walkingToleranceMinutes: 45,
        },
      },
      {
        name: 'Ravi',
        submittedAt: '2026-09-02T09:05:00.000Z',
        preferences: {
          pace: 'RELAXED',
          accessibilityWheelchair: true,
          accessibilityVision: false,
          accessibilityHearing: false,
          accessibilityCognitive: false,
          interests: ['Heritage'],
          transportPreference: 'CAB',
          walkingToleranceMinutes: 20,
        },
      },
    ]);

    expect(result.blended).toMatchObject({
      pace: 'RELAXED',
      accessibilityWheelchair: true,
      interests: ['Heritage', 'Food'],
      transportPreference: 'MIXED',
      walkingToleranceMinutes: 20,
    });
    expect(result.allocation).toEqual({ Heritage: 67, Food: 33 });
    expect(result.constraints).toContain('Wheelchair accessibility required (strictest across group)');
  });
});
