import { describe, expect, it } from 'vitest';
import {
  computeAccessibilityPenalty,
  computeEmergencyPenalty,
  computeTransportPenalty,
  healthPreferencesFrom,
} from '../src/modules/scoring/trip-health.js';

describe('trip health scoring helpers', () => {
  it('restores health preferences from planner input before user defaults', () => {
    expect(healthPreferencesFrom({
      preferences: {
        transportPreference: 'WALKING',
        accessibilityWheelchair: true,
        accessibilityVision: false,
        accessibilityHearing: true,
        accessibilityCognitive: false,
        walkingToleranceMinutes: 20,
      },
    }, {
      transportPreference: 'CAB',
      accessibilityMobility: false,
      accessibilityVision: true,
      accessibilityHearing: false,
      accessibilityCognitive: true,
      walkingToleranceMinutes: 60,
    })).toMatchObject({
      transportPreference: 'WALKING',
      accessibilityWheelchair: true,
      accessibilityVision: false,
      accessibilityHearing: true,
      accessibilityCognitive: false,
      walkingToleranceMinutes: 20,
    });
  });

  it('penalizes unavailable routes and walking buffers over tolerance', () => {
    const score = computeTransportPenalty([
      {
        travelBufferMinutesBefore: 75,
        trustSummary: { warnings: ['Routing unavailable; estimated buffer used'] },
        attraction: {
          name: 'Museum',
          accessibilityWheelchair: true,
          accessibilityVisual: true,
          accessibilityHearing: true,
        },
      },
    ], {
      transportPreference: 'WALKING',
      accessibilityWheelchair: false,
      accessibilityVision: false,
      accessibilityHearing: false,
      accessibilityCognitive: false,
      walkingToleranceMinutes: 30,
    });

    expect(score.category).toBe('transport');
    expect(score.penalty).toBeGreaterThan(0);
    expect(score.factors.map((factor) => factor.description).join(' ')).toContain('walking buffer exceeds');
  });

  it('penalizes accessibility mismatches against saved preferences', () => {
    const score = computeAccessibilityPenalty([
      {
        travelBufferMinutesBefore: 10,
        trustSummary: {},
        attraction: {
          name: 'Fort',
          accessibilityWheelchair: false,
          accessibilityVisual: true,
          accessibilityHearing: false,
        },
      },
    ], {
      transportPreference: 'MIXED',
      accessibilityWheelchair: true,
      accessibilityVision: false,
      accessibilityHearing: true,
      accessibilityCognitive: false,
    });

    expect(score.category).toBe('accessibility');
    expect(score.penalty).toBeGreaterThan(0);
    expect(score.factors).toHaveLength(2);
  });

  it('checks regional and personal emergency readiness', () => {
    const score = computeEmergencyPenalty(
      { region: 'Unmapped Region' },
      { emergencyContactPhone: null },
    );

    expect(score.category).toBe('emergency');
    expect(score.penalty).toBe(2);
    expect(score.factors.map((factor) => factor.description).join(' ')).toContain('personal emergency contact');
  });
});
