import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import '../src/shared/config/index.js';
import { prisma } from '../src/shared/db/index.js';

const BASE_URL = process.env.API_TEST_BASE_URL ?? 'http://localhost:3001';
const API = '/api/v1';

const token = process.env.API_TEST_BEARER_TOKEN ?? '';
const authHeader = `Bearer ${token}`;
const tripTitlePrefix = 'E2E API Flow Trip';
const authIt = token ? it : it.skip;

let tripId = '';
let shareToken = '';

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function cleanup(): Promise<void> {
  if (tripId) {
    await prisma.trip.deleteMany({ where: { id: tripId } });
  }

  if (token) {
    await prisma.trip.deleteMany({
      where: { title: { startsWith: tripTitlePrefix } },
    });
  }
}

describe('E2E API flow', () => {
  beforeAll(async () => {
    const health = await request(BASE_URL).get('/api/health');
    expect(
      health.status,
      'Start the backend first with npm run dev.',
    ).toBe(200);

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('rejects protected routes without auth', async () => {
    const response = await request(BASE_URL).get(`${API}/trips`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  authIt('rejects invalid UUID params before hitting storage', async () => {
    const response = await request(BASE_URL)
      .get(`${API}/trips/not-a-uuid`)
      .set('Authorization', authHeader);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  authIt('accepts auth from an access_token cookie', async () => {
    const response = await request(BASE_URL)
      .get(`${API}/users/me`)
      .set('Cookie', [`access_token=${token}`]);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBeTruthy();
  });

  authIt('creates, reads, publishes, shares, updates, and deletes a trip', async () => {
    const createResponse = await request(BASE_URL)
      .post(`${API}/trips`)
      .set('Authorization', authHeader)
      .send({
        destinationId: 'bhubaneswar-odisha',
        title: `${tripTitlePrefix} ${Date.now()}`,
        startDate: daysFromNow(1),
        endDate: daysFromNow(3),
        status: 'DRAFT',
      });

    expect(createResponse.status).toBe(201);
    tripId = createResponse.body.data.id;
    expect(tripId).toMatch(/^[0-9a-f-]{36}$/i);

    const getByIdResponse = await request(BASE_URL)
      .get(`${API}/trips/${tripId}`)
      .set('Authorization', authHeader);

    expect(getByIdResponse.status).toBe(200);
    expect(getByIdResponse.body.data.id).toBe(tripId);

    const publishResponse = await request(BASE_URL)
      .patch(`${API}/trips/${tripId}`)
      .set('Authorization', authHeader)
      .send({ title: 'Updated E2E API Flow Trip', status: 'PLANNED', isPublic: true });

    expect(publishResponse.status).toBe(200);
    expect(publishResponse.body.data.title).toBe('Updated E2E API Flow Trip');
    shareToken = publishResponse.body.data.shareToken;
    expect(shareToken).toMatch(/^[a-f0-9]{64}$/i);

    const getByShareTokenResponse = await request(BASE_URL).get(`${API}/trips/share/${shareToken}`);

    expect(getByShareTokenResponse.status).toBe(200);
    expect(getByShareTokenResponse.body.data.id).toBe(tripId);

    const deleteResponse = await request(BASE_URL)
      .delete(`${API}/trips/${tripId}`)
      .set('Authorization', authHeader);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.success).toBe(true);

    const getDeletedResponse = await request(BASE_URL)
      .get(`${API}/trips/${tripId}`)
      .set('Authorization', authHeader);

    expect(getDeletedResponse.status).toBe(404);
    tripId = '';
  }, 20_000);
});
