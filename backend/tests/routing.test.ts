import { describe, expect, it } from 'vitest';
import { getRoute } from '../src/modules/live-data/routing.js';

describe('live route geometry', () => {
  it('returns provider geometry when OpenRouteService includes it', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      features: [{
        geometry: { type: 'LineString', coordinates: [[85.8245, 20.2961], [85.84, 20.27]] },
        properties: { segments: [{ distance: 3500, duration: 900 }] },
      }],
    }), { status: 200 });

    const route = await getRoute(20.2961, 85.8245, 20.27, 85.84, 'driving-car', fetchImpl as typeof fetch);

    expect(route).toMatchObject({
      distance_meters: 3500,
      duration_seconds: 900,
      source: 'OPENROUTESERVICE',
      geometry: { type: 'LineString' },
    });
    expect(route.geometry.coordinates).toHaveLength(2);
  });

  it('falls back to straight-line geometry when routing fails', async () => {
    const fetchImpl = async () => new Response('{}', { status: 503 });
    const route = await getRoute(20.2962, 85.8246, 20.2701, 85.8401, 'foot-walking', fetchImpl as typeof fetch);

    expect(route.source).toBe('FALLBACK_STRAIGHT_LINE');
    expect(route.distance_meters).toBeGreaterThan(0);
    expect(route.geometry.coordinates).toEqual([[85.8246, 20.2962], [85.8401, 20.2701]]);
  });
});
