import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { openApiDocument } from '../src/swagger.js';

const requiredPaths = [
  '/api/v1/nlu/extract-delta',
  '/api/v1/trips/{id}/itinerary/replan',
  '/api/v1/attractions/{id}/suitability',
  '/api/v1/scoring/trip-health/{id}',
  '/api/v1/scoring/tourism-impact',
  '/api/v1/scoring/trip-trust/{id}',
  '/api/v1/groups',
  '/api/v1/groups/{code}',
  '/api/v1/groups/{code}/join',
  '/api/v1/groups/{code}/generate',
] as const;

describe('OpenAPI route inventory', () => {
  it('documents mounted advanced backend routes', () => {
    for (const path of requiredPaths) {
      expect(openApiDocument.paths).toHaveProperty(path);
    }
  });

  it('keeps the markdown endpoint summary aligned with advanced routes', () => {
    const apiDoc = readFileSync(new URL('../API.md', import.meta.url), 'utf8');
    for (const path of requiredPaths) {
      expect(apiDoc).toContain(path.replace('{id}', ':id').replace('{code}', ':code'));
    }
  });
});
