/**
 * MargDarshak Backend — Full API Test Suite
 * Tests every registered endpoint with realistic payloads.
 * Outputs a clear PASS/FAIL report with error details.
 *
 * Run public smoke checks: npx tsx scripts/api-test.ts
 * Run auth checks too: API_TEST_BEARER_TOKEN=<supabase-access-token> npx tsx scripts/api-test.ts
 */

import '../src/shared/config/index.js';
import { prisma } from '../src/shared/db/index.js';

const BASE = 'http://localhost:3001';
const API  = `${BASE}/api/v1`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Result {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  statusCode?: number;
  detail?: string;
  durationMs: number;
}

const results = [] as Result[];
let authToken  = process.env.API_TEST_BEARER_TOKEN ?? '';
let tripId     = '';
let shareToken = '';
let attrId     = '';
let destId     = 'bhubaneswar-odisha'; // legacy frontend slug, resolved by backend
let crowdRecordId = '';
let feedbackId = '';

// ─── Helper ───────────────────────────────────────────────────────────────────
async function test(
  name: string,
  fn: () => Promise<{ ok: boolean; status: number; body: unknown }>
): Promise<void> {
  const start = Date.now();
  try {
    const { ok, status, body } = await fn();
    const ms = Date.now() - start;
    const b = body as Record<string, unknown>;

    if (!ok) {
      results.push({
        name, status: 'FAIL', statusCode: status, durationMs: ms,
        detail: `HTTP ${status} — ${JSON.stringify(b?.error ?? b).slice(0, 200)}`,
      });
    } else {
      results.push({ name, status: 'PASS', statusCode: status, durationMs: ms });
    }
  } catch (err) {
    results.push({
      name, status: 'FAIL', durationMs: Date.now() - start,
      detail: `Threw: ${(err as Error).message}`,
    });
  }
}

function addWarning(name: string, detail: string): void {
  results.push({ name, status: 'WARN', durationMs: 0, detail });
}

async function cleanupCreatedRecords(): Promise<void> {
  try {
    if (tripId) await prisma.trip.deleteMany({ where: { id: tripId } });
    if (feedbackId) await prisma.feedback.deleteMany({ where: { id: feedbackId } });
    if (crowdRecordId) await prisma.crowdCapacityRecord.deleteMany({ where: { id: crowdRecordId } });
  } catch (err) {
    addWarning('Authenticated test cleanup', (err as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

async function req(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed: unknown;
  try { parsed = await res.json(); } catch { parsed = {}; }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function reqRaw(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; body: ArrayBuffer; headers: Headers }> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, body: await res.arrayBuffer(), headers: res.headers };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

async function testHealth() {
  await test('GET /api/health', async () => {
    const r = await req('GET', `${BASE}/api/health`);
    const b = r.body as Record<string, unknown>;
    if (b.status !== 'healthy') return { ...r, ok: false };
    return r;
  });
}

async function testAuth() {
  await test('GET /users/me (no token -> 401)', async () => {
    const saved = authToken;
    authToken = '';
    const r = await req('GET', `${API}/users/me`);
    authToken = saved;
    return { ...r, ok: r.status === 401 };
  });
}

async function testUsers() {
  await test('GET /users/me', async () => {
    const r = await req('GET', `${API}/users/me`);
    return r;
  });

  await test('PATCH /users/me (update name)', async () => {
    return req('PATCH', `${API}/users/me`, { name: 'Updated Name' });
  });

  await test('GET /users/me/preferences (fresh user = defaults)', async () => {
    const r = await req('GET', `${API}/users/me/preferences`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    // Should return pace field either from DB or defaults
    if (r.ok && !data.pace) return { ...r, ok: false };
    return r;
  });

  await test('PUT /users/me/preferences', async () => {
    return req('PUT', `${API}/users/me/preferences`, {
      pace: 'RELAXED',
      groupType: 'FAMILY',
      interests: ['Heritage', 'Spiritual'],
      transportPreference: 'OWN_VEHICLE',
      accessibilityMobility: true,
      walkingToleranceMinutes: 20,
    });
  });

  await test('PATCH /users/me/preferences (partial)', async () => {
    return req('PATCH', `${API}/users/me/preferences`, { pace: 'MODERATE' });
  });

  await test('GET /users/me (invalid token -> 401)', async () => {
    const r = await req('GET', `${API}/users/me`, undefined, { Authorization: 'Bearer invalid' });
    return { ...r, ok: r.status === 401 };
  });
}

async function testKnowledge() {
  await test('GET /knowledge/destinations', async () => {
    const r = await req('GET', `${API}/knowledge/destinations`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && data.length < 5) return { ...r, ok: false };
    return r;
  });

  await test('GET /knowledge/destinations/:id', async () => {
    return req('GET', `${API}/knowledge/destinations/${destId}`);
  });

  await test('GET /knowledge/destinations/:id (unknown ID -> 404)', async () => {
    const r = await req('GET', `${API}/knowledge/destinations/nonexistent-id-xyz`);
    return { ...r, ok: r.status === 404 };
  });

  await test('GET /knowledge/destinations/:id/attractions', async () => {
    const r = await req('GET', `${API}/knowledge/destinations/${destId}/attractions`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok) {
      attrId = (data[0] as Record<string, unknown>).id as string;
    }
    if (r.ok && data.length < 1) return { ...r, ok: false };
    return r;
  });

  await test('GET /knowledge/destinations/:id/attractions?accessibilityWheelchair=true', async () => {
    return req('GET', `${API}/knowledge/destinations/${destId}/attractions?accessibilityWheelchair=true`);
  });

  await test('GET /knowledge/destinations/:id/attractions?indoorOutdoor=indoor', async () => {
    return req('GET', `${API}/knowledge/destinations/${destId}/attractions?indoorOutdoor=indoor`);
  });

  await test('GET /knowledge/destinations/:id/attractions?search=temple', async () => {
    const r = await req('GET', `${API}/knowledge/destinations/${destId}/attractions?search=temple`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    // Should find at least Lingaraj Temple
    if (r.ok && data.length === 0) return { ...r, ok: false };
    return r;
  });
}

async function testAttractions() {
  await test('GET /attractions/:id/facts', async () => {
    const r = await req('GET', `${API}/attractions/${attrId}/facts`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && data.length < 1) return { ...r, ok: false };
    return r;
  });

  await test('GET /attractions/lingaraj-temple/facts slug compatibility', async () => {
    const r = await req('GET', `${API}/attractions/lingaraj-temple/facts`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && data.length < 1) return { ...r, ok: false };
    return r;
  });

  await test('GET /attractions/:id/alternatives', async () => {
    const r = await req('GET', `${API}/attractions/${attrId}/alternatives`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && data.length < 1) return { ...r, ok: false };
    return r;
  });

  await test('GET /attractions/nonexistent/facts -> 404', async () => {
    // Unknown slug-shaped IDs are accepted by validation, then miss in storage.
    const r = await req('GET', `${API}/attractions/nonexistent/facts`);
    return { ...r, ok: r.status === 404 };
  });
}

async function testNLU() {
  await test('POST /nlu/extract (Gemini)', async () => {
    const r = await req('POST', `${API}/nlu/extract`, {
      prompt: 'I want a relaxed family trip to heritage sites, we need wheelchair access',
    });
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    const meta = b.meta as Record<string, unknown> | undefined;
    if (r.ok && meta?.fallback_used) {
      addWarning('POST /nlu/extract fallback', String(meta.reason ?? 'Gemini fallback used'));
    }
    if (r.ok && !data.pace) return { ...r, ok: false };
    return r;
  });

  await test('POST /nlu/extract (too short prompt → 400)', async () => {
    const r = await req('POST', `${API}/nlu/extract`, { prompt: 'hi' });
    return { ...r, ok: r.status === 400 };
  });

  await test('POST /nlu/narrate', async () => {
    const r = await req('POST', `${API}/nlu/narrate`, {
      itinerary: [
        { attractionName: 'Lingaraj Temple', startTime: '09:00', endTime: '11:00' },
        { attractionName: 'Odisha State Museum', startTime: '12:00', endTime: '14:00' },
      ],
      validFactIds: [],
    });
    const b = r.body as Record<string, unknown>;
    const meta = b.meta as Record<string, unknown> | undefined;
    if (r.ok && meta?.fallback_used) {
      addWarning('POST /nlu/narrate fallback', String(meta.reason ?? 'Gemini fallback used'));
    }
    return r;
  });

  await test('POST /nlu/speech invalid text -> 400', async () => {
    const r = await req('POST', `${API}/nlu/speech`, { text: 'hi' });
    return { ...r, ok: r.status === 400 };
  });

  await test('POST /nlu/speech', async () => {
    const r = await reqRaw('POST', `${API}/nlu/speech`, { text: 'Say warmly: Welcome to Bhubaneswar.', format: 'wav' });
    if (r.status === 503) {
      addWarning('POST /nlu/speech unavailable', 'Gemini TTS unavailable');
      return { ok: true, status: r.status, body: {} };
    }

    const header = new Uint8Array(r.body.slice(0, 4));
    const startsWithWav = header[0] === 82 && header[1] === 73 && header[2] === 70 && header[3] === 70;
    return { ok: r.ok && r.headers.get('content-type')?.includes('audio/wav') === true && startsWithWav, status: r.status, body: {} };
  });
}

async function testPlanner() {
  const plannerPayload = {
    destinationId: destId,
    startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    days: 2,
    preferences: {
      pace: 'MODERATE',
      groupType: 'COUPLE',
      transportPreference: 'OWN_VEHICLE',
      interests: ['Heritage', 'Spiritual'],
      accessibilityWheelchair: false,
      accessibilityVision: false,
      accessibilityHearing: false,
      accessibilityCognitive: false,
      walkingToleranceMinutes: 30,
      indoorOutdoorPreference: 'mixed',
      localBusinessPreference: false,
    },
  };

  await test('POST /planner/generate', async () => {
    const r = await req('POST', `${API}/planner/generate`, {
      ...plannerPayload,
    });
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok && !(data?.itineraryItems as unknown[])?.length) {
      // Zero items is acceptable — could mean all attractions are closed/excluded
      return { ...r, ok: true };
    }
    return r;
  });

  await test('POST /planner/generate invalid payload -> 400', async () => {
    const r = await req('POST', `${API}/planner/generate`, { destinationId: destId, days: 0 });
    return { ...r, ok: r.status === 400 };
  });

  await test('POST /planner/generate saveTrip without token -> 401', async () => {
    const savedToken = authToken;
    authToken = '';
    const r = await req('POST', `${API}/planner/generate`, {
      ...plannerPayload,
      saveTrip: true,
    });
    authToken = savedToken;
    return { ...r, ok: r.status === 401 };
  });
}


async function testLiveData() {
  // Bhubaneswar coordinates
  await test('GET /live/weather?lat=20.2961&lon=85.8245', async () => {
    return req('GET', `${API}/live/weather?lat=20.2961&lon=85.8245`);
  });

  await test('GET /live/weather invalid latitude -> 400', async () => {
    const r = await req('GET', `${API}/live/weather?lat=200&lon=85.8245`);
    return { ...r, ok: r.status === 400 };
  });

  // Note: the route endpoint is /live/route not /live/transport
  await test('GET /live/route (routing between two Bhubaneswar sites)', async () => {
    return req('GET', `${API}/live/route?startLat=20.2381&startLon=85.8336&endLat=20.2548&endLon=85.8431`);
  });
}

async function testServices() {
  await test('GET /services/exchange-rates', async () => {
    return req('GET', `${API}/services/exchange-rates`);
  });

  await test('GET /services/holidays', async () => {
    const year = new Date().getFullYear();
    return req('GET', `${API}/services/holidays?countryCode=IN&year=${year}`);
  });

  await test('GET /services/country-info/IN', async () => {
    return req('GET', `${API}/services/country-info/IN`);
  });

  await test('GET /services/safety-pulse', async () => {
    return req('GET', `${API}/services/safety-pulse`);
  });
}

async function testEmergency() {
  await test('GET /emergency national contacts', async () => {
    const r = await req('GET', `${API}/emergency`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    const contacts = data.contacts as unknown[];
    if (r.ok && (!Array.isArray(contacts) || contacts.length === 0)) return { ...r, ok: false };
    return r;
  });

  await test('GET /emergency with destination slug', async () => {
    const r = await req('GET', `${API}/emergency?destinationId=bhubaneswar-odisha`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    const destination = data.destination as Record<string, unknown> | null;
    const contacts = data.contacts as unknown[];
    if (r.ok && (!destination?.id || contacts.length <= 7)) return { ...r, ok: false };
    return r;
  });

  await test('GET /emergency unsupported country -> 400', async () => {
    const r = await req('GET', `${API}/emergency?countryCode=US`);
    return { ...r, ok: r.status === 400 };
  });
}

async function testGuide() {
  await test('GET /guide/destinations/:id', async () => {
    const r = await req('GET', `${API}/guide/destinations/bhubaneswar-odisha`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    const attractions = data.attractions as unknown[];
    if (r.ok && (!Array.isArray(attractions) || attractions.length === 0)) return { ...r, ok: false };
    return r;
  });

  await test('GET /guide/attractions/:id', async () => {
    const r = await req('GET', `${API}/guide/attractions/lingaraj-temple`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    const facts = data.facts as unknown[];
    if (r.ok && (!Array.isArray(facts) || facts.length === 0)) return { ...r, ok: false };
    return r;
  });

  await test('GET /guide/attractions/:id unknown -> 404', async () => {
    const r = await req('GET', `${API}/guide/attractions/nonexistent-attraction`);
    return { ...r, ok: r.status === 404 };
  });
}

async function testBudget() {
  await test('GET /budget/destinations/:id', async () => {
    const r = await req('GET', `${API}/budget/destinations/bhubaneswar-odisha?travellers=2`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok && typeof data.totalAmount !== 'number') return { ...r, ok: false };
    return r;
  });

  await test('POST /budget/estimate', async () => {
    const r = await req('POST', `${API}/budget/estimate`, {
      attractionIds: ['lingaraj-temple', 'odisha-state-museum'],
      travellerType: 'INDIAN',
      travellers: 2,
    });
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    const lineItems = data.lineItems as unknown[];
    if (r.ok && (typeof data.totalAmount !== 'number' || !Array.isArray(lineItems) || lineItems.length !== 2)) {
      return { ...r, ok: false };
    }
    return r;
  });

  await test('POST /budget/estimate invalid payload -> 400', async () => {
    const r = await req('POST', `${API}/budget/estimate`, { attractionIds: [], travellers: 0 });
    return { ...r, ok: r.status === 400 };
  });
}

async function testPublicTripShare() {
  await test('GET /trips/share/:token invalid token -> 400', async () => {
    const r = await req('GET', `${API}/trips/share/short`);
    return { ...r, ok: r.status === 400 };
  });

  await test('GET /trips/share/:token/export invalid token -> 400', async () => {
    const r = await req('GET', `${API}/trips/share/short/export`);
    return { ...r, ok: r.status === 400 };
  });
}

async function testSearch() {
  await test('GET /search?q=temple', async () => {
    const r = await req('GET', `${API}/search?q=temple`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && (!Array.isArray(data) || data.length === 0)) return { ...r, ok: false };
    return r;
  });

  await test('GET /search invalid query -> 400', async () => {
    const r = await req('GET', `${API}/search?q=x`);
    return { ...r, ok: r.status === 400 };
  });
}

async function testNearby() {
  await test('GET /nearby around Bhubaneswar', async () => {
    const r = await req('GET', `${API}/nearby?lat=20.2961&lon=85.8245&radiusKm=20&limit=5`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && (!Array.isArray(data) || data.length === 0)) return { ...r, ok: false };
    return r;
  });

  await test('GET /nearby with destination slug', async () => {
    const r = await req('GET', `${API}/nearby?lat=20.2961&lon=85.8245&radiusKm=20&destinationId=bhubaneswar-odisha`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && (!Array.isArray(data) || data.length === 0)) return { ...r, ok: false };
    return r;
  });

  await test('GET /nearby invalid latitude -> 400', async () => {
    const r = await req('GET', `${API}/nearby?lat=200&lon=85.8245`);
    return { ...r, ok: r.status === 400 };
  });
}

async function testLocalBusinesses() {
  await test('GET /local-businesses', async () => {
    const r = await req('GET', `${API}/local-businesses?limit=5`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && !Array.isArray(data)) return { ...r, ok: false };
    return r;
  });

  await test('GET /local-businesses with destination slug', async () => {
    const r = await req('GET', `${API}/local-businesses?destinationId=bhubaneswar-odisha&locallyOwned=true`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && !Array.isArray(data)) return { ...r, ok: false };
    return r;
  });

  await test('GET /local-businesses invalid limit -> 400', async () => {
    const r = await req('GET', `${API}/local-businesses?limit=999`);
    return { ...r, ok: r.status === 400 };
  });
}

async function testCrowd() {
  await test('GET /crowd/attractions/:attractionId latest', async () => {
    const r = await req('GET', `${API}/crowd/attractions/lingaraj-temple`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok && data?.attractionId === undefined) return { ...r, ok: false };
    return r;
  });

  await test('GET /crowd/attractions/:attractionId unknown -> 404', async () => {
    const r = await req('GET', `${API}/crowd/attractions/nonexistent-attraction`);
    return { ...r, ok: r.status === 404 };
  });

  await test('POST /crowd/reports without token -> 401', async () => {
    const saved = authToken;
    authToken = '';
    const r = await req('POST', `${API}/crowd/reports`, {
      attractionId: 'lingaraj-temple',
      currentCrowdLevel: 'HIGH',
      capacityValue: 250,
    });
    authToken = saved;
    return { ...r, ok: r.status === 401 };
  });
}

async function testCrowdAuthenticated() {
  await test('POST /crowd/reports', async () => {
    const r = await req('POST', `${API}/crowd/reports`, {
      attractionId: attrId || 'lingaraj-temple',
      currentCrowdLevel: 'MODERATE',
      capacityValue: 125,
    });
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok) crowdRecordId = data.id as string;
    if (r.ok && data.verificationStatus !== 'COMMUNITY') return { ...r, ok: false };
    return r;
  });
}

async function testTrips() {
  await test('POST /trips (create trip)', async () => {
    const r = await req('POST', `${API}/trips`, {
      destinationId: destId,
      title: 'API Test Trip',
      startDate: new Date(Date.now() + 14 * 86400000).toISOString(), // full ISO datetime
      endDate: new Date(Date.now() + 16 * 86400000).toISOString(),   // full ISO datetime
    });
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok) tripId = data.id as string;
    return r;
  });

  await test('GET /trips (list user trips)', async () => {
    const r = await req('GET', `${API}/trips`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as unknown[];
    if (r.ok && !Array.isArray(data)) return { ...r, ok: false };
    return r;
  });

  await test('GET /trips/:id', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    return req('GET', `${API}/trips/${tripId}`);
  });

  await test('GET /trips/:id/export without snapshot -> 409', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    const r = await req('GET', `${API}/trips/${tripId}/export`);
    return { ...r, ok: r.status === 409 };
  });

  await test('POST /trips/:id/snapshot', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    return req('POST', `${API}/trips/${tripId}/snapshot`, {
      itinerarySnapshot: {
        destinationId: destId,
        days: 1,
        itineraryItems: [
          { dayNumber: 1, sequence: 1, attractionName: 'Lingaraj Temple', startTime: '09:00', endTime: '10:30', explanationText: 'Heritage stop from the saved API smoke itinerary.' },
        ],
      },
    });
  });

  await test('GET /trips/:id/export PDF', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    const r = await reqRaw('GET', `${API}/trips/${tripId}/export`);
    const header = new Uint8Array(r.body.slice(0, 5));
    const startsWithPdf = header[0] === 37 && header[1] === 80 && header[2] === 68 && header[3] === 70 && header[4] === 45;
    return { ok: r.ok && r.headers.get('content-type')?.includes('application/pdf') === true && startsWithPdf, status: r.status, body: {} };
  });

  await test('PATCH /trips/:id (update status)', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    return req('PATCH', `${API}/trips/${tripId}`, { status: 'PLANNED' });
  });

  await test('PATCH /trips/:id (enable public share)', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    const r = await req('PATCH', `${API}/trips/${tripId}`, { isPublic: true });
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok) shareToken = data.shareToken as string;
    if (r.ok && !shareToken) return { ...r, ok: false };
    return r;
  });

  await test('GET /trips/share/:token/export PDF', async () => {
    if (!shareToken) return { ok: false, status: 0, body: {} };
    const saved = authToken;
    authToken = '';
    const r = await reqRaw('GET', `${API}/trips/share/${shareToken}/export`);
    authToken = saved;
    const header = new Uint8Array(r.body.slice(0, 5));
    const startsWithPdf = header[0] === 37 && header[1] === 80 && header[2] === 68 && header[3] === 70 && header[4] === 45;
    return { ok: r.ok && r.headers.get('content-type')?.includes('application/pdf') === true && startsWithPdf, status: r.status, body: {} };
  });

  await test('GET /trips/share/:token', async () => {
    if (!shareToken) return { ok: false, status: 0, body: {} };
    const saved = authToken;
    authToken = '';
    const r = await req('GET', `${API}/trips/share/${shareToken}`);
    authToken = saved;
    return r;
  });

  await test('PATCH /trips/:id invalid dates -> 400', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    const r = await req('PATCH', `${API}/trips/${tripId}`, {
      startDate: new Date(Date.now() + 20 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 19 * 86400000).toISOString(),
    });
    return { ...r, ok: r.status === 400 };
  });

  await test('DELETE /trips/:id', async () => {
    if (!tripId) return { ok: false, status: 0, body: {} };
    const r = await req('DELETE', `${API}/trips/${tripId}`);
    if (r.ok) tripId = '';
    return r;
  });
}

async function testFavorites() {
  await test('GET /favorites (empty list)', async () => {
    const r = await req('GET', `${API}/favorites`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as { destinations?: unknown[]; attractions?: unknown[] };
    if (r.ok && (!Array.isArray(data.destinations) || !Array.isArray(data.attractions))) return { ...r, ok: false };
    return r;
  });

  await test('POST /favorites (add destination)', async () => {
    if (!destId) return { ok: false, status: 0, body: 'destId not available' };
    return req('POST', `${API}/favorites`, { destinationId: destId });
  });

  await test('POST /favorites (add attraction)', async () => {
    if (!attrId) return { ok: false, status: 0, body: 'attrId not available' };
    return req('POST', `${API}/favorites`, { attractionId: attrId });
  });

  await test('POST /favorites (duplicate → 201 no error)', async () => {
    if (!attrId) return { ok: false, status: 0, body: 'attrId not available' };
    return req('POST', `${API}/favorites`, { attractionId: attrId });
  });

  await test('DELETE /favorites/:attrId', async () => {
    if (!attrId) return { ok: false, status: 0, body: 'attrId not available' };
    return req('DELETE', `${API}/favorites/${attrId}`);
  });

  await test('DELETE /favorites/destinations/:destId', async () => {
    if (!destId) return { ok: false, status: 0, body: 'destId not available' };
    return req('DELETE', `${API}/favorites/destinations/${destId}`);
  });
}

async function testFeedback() {
  await test('POST /feedback', async () => {
    const r = await req('POST', `${API}/feedback`, {
      entityType: 'ATTRACTION',     // uppercase enum as schema requires
      entityId: attrId || 'lingaraj-temple',
      feedbackType: 'INACCURATE',
      comment: 'The temple now opens at 8am, not 6am.',
    });
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok) feedbackId = data.id as string;
    return r;
  });
}

async function testFeedbackAdminAccess() {
  const uuid = '00000000-0000-4000-8000-000000000000';

  await test('GET /feedback/admin/review-queue without token -> 401', async () => {
    const saved = authToken;
    authToken = '';
    const r = await req('GET', `${API}/feedback/admin/review-queue`);
    authToken = saved;
    return { ...r, ok: r.status === 401 };
  });

  await test('PATCH /feedback/admin/:id/review without token -> 401', async () => {
    const saved = authToken;
    authToken = '';
    const r = await req('PATCH', `${API}/feedback/admin/${uuid}/review`, { status: 'REVIEWED' });
    authToken = saved;
    return { ...r, ok: r.status === 401 };
  });

  await test('POST /feedback/admin/facts/:factId/reverify without token -> 401', async () => {
    const saved = authToken;
    authToken = '';
    const r = await req('POST', `${API}/feedback/admin/facts/${uuid}/reverify`, { verificationStatus: 'VERIFIED' });
    authToken = saved;
    return { ...r, ok: r.status === 401 };
  });

  if (!authToken) return;

  await test('GET /feedback/admin/review-queue with token', async () => {
    const r = await req('GET', `${API}/feedback/admin/review-queue`);
    return { ...r, ok: r.status === 200 || r.status === 403 };
  });

  await test('PATCH /feedback/admin/:id/review with token invalid UUID', async () => {
    const r = await req('PATCH', `${API}/feedback/admin/not-a-uuid/review`, { status: 'REVIEWED' });
    return { ...r, ok: r.status === 400 || r.status === 403 };
  });

  await test('POST /feedback/admin/facts/:factId/reverify with token invalid UUID', async () => {
    const r = await req('POST', `${API}/feedback/admin/facts/not-a-uuid/reverify`, { verificationStatus: 'VERIFIED' });
    return { ...r, ok: r.status === 400 || r.status === 403 };
  });
}

async function testAnalytics() {
  await test('GET /analytics/dashboard', async () => {
    const r = await req('GET', `${API}/analytics/dashboard`);
    const b = r.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    if (r.ok && data.totalTrips === undefined) return { ...r, ok: false };
    return r;
  });
}

// ─── Run All ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('🧪 MargDarshak API Test Suite');
  console.log(`   Target: ${BASE}`);
  console.log(`   Time:   ${new Date().toISOString()}\n`);

  // Public checks first. Auth-specific checks use a Supabase access token if provided.
  await testHealth();
  await testAuth();
  await testKnowledge();
  await testAttractions();
  await testNLU();
  await testPlanner();
  await testLiveData();
  await testServices();
  await testEmergency();
  await testGuide();
  await testBudget();
  await testPublicTripShare();
  await testSearch();
  await testNearby();
  await testLocalBusinesses();
  await testCrowd();
  await testFeedbackAdminAccess();

  if (authToken) {
    await testUsers();
    await testTrips();
    await testFavorites();
    await testCrowdAuthenticated();
    await testFeedback();
    await testAnalytics();
    await cleanupCreatedRecords();
  } else {
    addWarning('Authenticated route checks', 'Skipped; set API_TEST_BEARER_TOKEN to a Supabase access token.');
  }

  // ─── Report ───────────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const warn = results.filter((r) => r.status === 'WARN').length;

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  TEST RESULTS');
  console.log('══════════════════════════════════════════════════════');

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️ ' : '❌';
    const code = r.statusCode ? ` [${r.statusCode}]` : '';
    const ms   = `${r.durationMs}ms`;
    console.log(`${icon} ${r.name}${code} (${ms})`);
    if (r.detail) console.log(`      └─ ${r.detail}`);
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  PASS: ${pass}  FAIL: ${fail}  WARN: ${warn}  TOTAL: ${results.length}`);
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Test runner crashed:', e); process.exit(2); });
