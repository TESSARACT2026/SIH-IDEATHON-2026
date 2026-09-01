import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './shared/config/index.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { globalLimiter, strictLimiter, authLimiter } from './shared/middleware/rateLimiter.js';
import { prisma } from './shared/db/index.js';
import { openApiDocument, swaggerContentSecurityPolicy, swaggerHtml, swaggerInitScript } from './swagger.js';

const app = express();

// ─── Security & Parsing ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.CORS_ORIGIN],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(globalLimiter);

// ─── API Docs ───────────────────────────────────────────────────────────────
app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

app.get('/api/docs/swagger-init.js', (_req, res) => {
  res.type('application/javascript').send(swaggerInitScript);
});

app.get('/api/docs', (_req, res) => {
  res.setHeader('Content-Security-Policy', swaggerContentSecurityPolicy);
  res.type('html').send(swaggerHtml);
});

// ─── UptimeRobot Lightweight Health Check ─────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Production Health Check ────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const start = Date.now();
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // Database connectivity check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: 'error',
      error: 'Database connection failed',
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '1.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    checks,
    response_time_ms: Date.now() - start,
  });
});

import knowledgeRouter from './modules/knowledge/index.js';
import attractionsRouter from './modules/attractions/index.js';
import liveDataRouter from './modules/live-data/index.js';
import plannerRouter from './modules/planner/index.js';
import nluRouter from './modules/nlu/index.js';
import feedbackRouter from './modules/feedback/index.js';
import usersRouter from './modules/users/index.js';
import favoritesRouter from './modules/favorites/index.js';
import tripsRouter from './modules/trips/index.js';
import servicesRouter from './modules/services/index.js';
import analyticsRouter from './modules/analytics/index.js';
import searchRouter from './modules/search/index.js';
import nearbyRouter from './modules/nearby/index.js';
import localBusinessesRouter from './modules/local-businesses/index.js';
import crowdRouter from './modules/crowd/index.js';
import emergencyRouter from './modules/emergency/index.js';
import guideRouter from './modules/guide/index.js';
import budgetRouter from './modules/budget/index.js';
import replanRouter from './modules/planner/replan.js';
import whatifNluRouter from './modules/planner/whatif-nlu.js';
import suitabilityRouter from './modules/attractions/suitability.js';
import tripHealthRouter from './modules/scoring/trip-health.js';
import tourismImpactRouter from './modules/scoring/tourism-impact.js';
import tripTrustRouter from './modules/scoring/trip-trust.js';
import groupRouter from './modules/group/index.js';

// ─── API v1 Routes ──────────────────────────────────────────────────────────
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/knowledge', knowledgeRouter);
app.use('/api/v1/attractions', attractionsRouter);
app.use('/api/v1/live', liveDataRouter);
app.use('/api/v1/planner', strictLimiter, plannerRouter);
app.use('/api/v1/nlu', strictLimiter, nluRouter);
app.use('/api/v1/feedback', feedbackRouter);
app.use('/api/v1/favorites', favoritesRouter);
app.use('/api/v1/trips', tripsRouter);
app.use('/api/v1/services', servicesRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/nearby', nearbyRouter);
app.use('/api/v1/local-businesses', localBusinessesRouter);
app.use('/api/v1/crowd', crowdRouter);
app.use('/api/v1/emergency', emergencyRouter);
app.use('/api/v1/guide', guideRouter);
app.use('/api/v1/budget', budgetRouter);

// ─── Batch 2: Advanced Differentiator Features ─────────────────────────────
app.use('/api/v1/trips', replanRouter);                     // Feature 1: What-If Replan
app.use('/api/v1/nlu', strictLimiter, whatifNluRouter);     // Feature 1: What-If NLU
app.use('/api/v1/attractions', suitabilityRouter);          // Feature 3: Suitability Check
app.use('/api/v1/scoring', tripHealthRouter);               // Feature 2: Trip Health Score
app.use('/api/v1/scoring', tourismImpactRouter);            // Feature 4: Tourism Impact
app.use('/api/v1/scoring', tripTrustRouter);                // Feature 10: Trip Trust Score
app.use('/api/v1/groups', groupRouter);                     // Feature 8: Group Planning

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.' },
  });
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`\n🚀 Travel Assistant API running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${env.PORT}/api/health\n`);
});

export default app;
