import { describe, expect, it } from 'vitest';
import { detectVoiceIntent, rankVoiceNearbyAttractions } from '../src/modules/nlu/index.js';

const attractions = [
  {
    id: 'market',
    destinationId: 'dest',
    name: 'Busy Market',
    categories: ['Shopping'],
    latitude: 20.001,
    longitude: 85,
    address: null,
    description: 'Crowded shopping lane',
    indoorOutdoor: 'outdoor',
    accessibilityWheelchair: true,
    accessibilityVisual: false,
    accessibilityHearing: false,
  },
  {
    id: 'temple',
    destinationId: 'dest',
    name: 'Quiet Temple',
    categories: ['Spiritual', 'Heritage'],
    latitude: 20.01,
    longitude: 85,
    address: null,
    description: 'Peaceful heritage stop',
    indoorOutdoor: 'outdoor',
    accessibilityWheelchair: true,
    accessibilityVisual: false,
    accessibilityHearing: false,
  },
];

describe('voice command helpers', () => {
  it('detects context-aware travel intents from natural language', () => {
    expect(detectVoiceIntent('MargDarshak, mujhe abhi nearby kuch peaceful jagah chahiye')).toBe('NEARBY_RECOMMENDATIONS');
    expect(detectVoiceIntent('Please read my itinerary')).toBe('READ_ITINERARY');
    expect(detectVoiceIntent('Download my trip offline')).toBe('DOWNLOAD_OFFLINE_PACK');
    expect(detectVoiceIntent('What if it rains tomorrow?')).toBe('WHAT_IF_REPLAN');
    expect(detectVoiceIntent('I need emergency help')).toBe('EMERGENCY_HELP');
  });

  it('ranks peaceful nearby options above closer noisy matches when requested', () => {
    const ranked = rankVoiceNearbyAttractions({
      utterance: 'nearby peaceful place',
      origin: { latitude: 20, longitude: 85 },
      attractions,
      radiusKm: 5,
    });

    expect(ranked.map((item) => item.id)).toEqual(['temple', 'market']);
  });
});
