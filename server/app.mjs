/**
 * @module server/app
 * @description Master Modular API Gateway Middleware for SIH Industrial Thermal Anomaly System.
 *
 * Dedicated strictly to:
 *   - NASA FIRMS satellite thermal anomaly ingestion, validation, and normalization
 *   - Two-stage classification (INDUSTRIAL vs NON-INDUSTRIAL & discrete subtypes)
 *   - Industrial facility infrastructure spatial association & HazMat profiles
 *   - Spatio-temporal persistence and abnormal thermal surge detection
 *   - Real-Time SSE alert broadcasting & Kubernetes health observability
 */

import crypto from 'node:crypto';
import { handleFirmsApiRoute } from './routes/firmsApi.mjs';
import { handleIndustrialRoute } from './routes/industrial.mjs';
import { handleRespondersRoute } from './routes/responders.mjs';
import { handleDispersionRoute } from './routes/dispersion.mjs';
import { handleWeatherRoute } from './routes/weather.mjs';
import { handleDossierRoute } from './routes/dossier.mjs';
import { handleSimulationRoute } from './routes/simulation.mjs';
import { handleAlertsRoute } from './routes/alerts.mjs';
import { handleProtectedAreasRoute } from './routes/protectedAreas.mjs';
import { handleGisLayersRoute } from './routes/gisLayers.mjs';
import { handleEventsRoute } from './routes/events.mjs';
import { handleHazmatRoute } from './routes/hazmat.mjs';
import { handleAgniRoute } from './routes/agni.mjs';
import { handleEventsStreamRoute } from './routes/stream.mjs';
import { handleLivenessRoute, handleReadinessRoute, handleMetricsRoute } from './routes/health.mjs';
import { sendJson, sendError, getClientIp, isPrivateIp } from './middleware/security.mjs';
import { metricsRegistry } from './services/metrics.mjs';
import { authenticateRequest } from './middleware/auth.mjs';
import { createRateLimiter } from './services/rateLimit.mjs';
import { validateRequestBody } from './middleware/validation.mjs';
import { keylessHudSummaryResponse } from '../src/hudSummaryResponse.js';
import { keySetupStatus } from '../src/keySetupCore.mjs';

// Initialize rate limiter: 1200 requests/min in dev mode for UI exploration, 120 in production
const isDev = (process.env.APP_ENV || 'development') === 'development';
const checkRateLimit = createRateLimiter({ maxTokens: isDev ? 1200 : 120, refillIntervalMs: 60000 });

/**
 * Connect-style middleware dispatcher for all SIH FIRMS Industrial Thermal Anomaly endpoints.
 */
export function createSriVisionMiddleware() {
  return async function sriVisionApiMiddleware(req, res, next) {
    const rawUrl = req.url || '/';

    // 1. Root Health Probes
    if (rawUrl === '/healthz') {
      req.traceId = crypto.randomUUID();
      return handleLivenessRoute(req, res);
    }
    if (rawUrl === '/readyz') {
      req.traceId = crypto.randomUUID();
      return handleReadinessRoute(req, res);
    }

    if (!rawUrl.startsWith('/api/')) {
      return next();
    }

    // 2. Trace Context Setup
    const incomingTraceId = req.headers?.['x-request-id'];
    req.traceId = incomingTraceId || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.traceId);

    const startTime = Date.now();
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    // Track response finish to record RED metrics
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      metricsRegistry.recordRequest(req.method || 'GET', pathname, res.statusCode, durationMs);
    });

    // ── Security Gate: Rate Limiting ──
    const clientIp = getClientIp(req);
    if (!isDev || !isPrivateIp(clientIp)) {
      if (!checkRateLimit(clientIp)) {
        return sendError(res, 429, 'RATE_LIMIT_EXCEEDED',
          'Too many requests. Please retry after 60 seconds.',
          [`Client IP: ${clientIp}`], req,
          { 'Retry-After': '60' }
        );
      }
    }

    // ── Security Gate: Authentication ──
    if (!authenticateRequest(req, res)) {
      return; // authenticateRequest already sent 401/403 response
    }

    try {
      // 3. Core Probes & Observability
      if (pathname === '/api/health' || pathname === '/api/health/live') {
        return await handleLivenessRoute(req, res);
      }
      if (pathname === '/api/health/ready') {
        return await handleReadinessRoute(req, res);
      }
      if (pathname === '/api/metrics') {
        return await handleMetricsRoute(req, res);
      }

      // 4. Real-Time Streaming (SSE) & Voice Session Tokens
      if (pathname === '/api/events/stream' || pathname === '/api/firms/stream') {
        return handleEventsStreamRoute(req, res, url);
      }
      if (pathname === '/api/realtime/token') {
        // Generate per-request ephemeral session token for voice AI sessions.
        // NOTE: In production, this should validate user credentials and return
        // a short-lived JWT signed with a server secret.
        const sessionToken = crypto.randomUUID();
        const ephemeralKey = crypto.randomBytes(16).toString('base64url');
        return sendJson(res, 200, {
          ok: true,
          token: sessionToken,
          ephemeral_key: ephemeralKey,
          expires_in_seconds: 3600,
          warning: process.env.APP_ENV === 'development' ? 'Development mode: token is not authenticated' : undefined,
        });
      }
      if (pathname === '/api/realtime/debug-log') {
        return sendJson(res, 200, { ok: true }, {}, req);
      }
      if (pathname === '/api/openai/hud-summary') {
        const keyless = keylessHudSummaryResponse(process.env.OPENAI_API_KEY);
        if (keyless) {
          return sendJson(res, 200, keyless.payload, { 'Cache-Control': 'no-store' }, req);
        }
        return sendJson(res, 200, {
          configured: true,
          summary: 'FIRMS VIIRS/MODIS thermal monitoring active. Real-time satellite surveillance engaged.',
        }, { 'Cache-Control': 'no-store' }, req);
      }
      if (pathname === '/api/setup/status') {
        return sendJson(res, 200, keySetupStatus(process.env), { 'Cache-Control': 'no-store' }, req);
      }

      // 5. Spatiotemporal Incident Clustering (/api/v1/firms/clusters/*)
      if (pathname === '/api/v1/firms/clusters' || pathname.startsWith('/api/v1/firms/clusters/') || pathname === '/api/v1/events' || pathname.startsWith('/api/v1/events/')) {
        return await handleEventsRoute(req, res, url);
      }

      // 6. SIH FIRMS Industrial Thermal Anomaly Domain Endpoints (/api/v1/firms/* and /api/firms)
      if (pathname === '/api/firms' || pathname.startsWith('/api/firms/') || pathname.startsWith('/api/v1/firms/')) {
        return await handleFirmsApiRoute(req, res, url);
      }

      // 7. Protected-Area & Forest Threat Intelligence (/api/v1/protected-areas/*)
      if (pathname === '/api/v1/protected-areas' || pathname.startsWith('/api/v1/protected-areas/')) {
        return await handleProtectedAreasRoute(req, res, url);
      }

      // 8. Critical Infrastructure GIS Overlays (/api/v1/gis/*)
      if (pathname === '/api/v1/gis' || pathname.startsWith('/api/v1/gis/') || pathname === '/api/gis' || pathname.startsWith('/api/gis/')) {
        return await handleGisLayersRoute(req, res, url);
      }

      // 9. NOAA CAMEO & NIOSH HazMat Chemical Registry (/api/v1/hazmat/*)
      if (pathname === '/api/v1/hazmat' || pathname.startsWith('/api/v1/hazmat/') || pathname === '/api/hazmat' || pathname.startsWith('/api/hazmat/')) {
        return await handleHazmatRoute(req, res, url);
      }

      // 10. Industrial Infrastructure, HazMat & Tactical Response Supporting Intelligence
      if (pathname === '/api/industrial' || pathname.startsWith('/api/industrial/')) {
        return await handleIndustrialRoute(req, res, url);
      }
      if (pathname === '/api/responders' || pathname.startsWith('/api/responders/')) {
        return await handleRespondersRoute(req, res, url);
      }
      if (pathname === '/api/dispersion' || pathname.startsWith('/api/dispersion/')) {
        return await handleDispersionRoute(req, res, url);
      }
      if (pathname === '/api/weather' || pathname.startsWith('/api/weather/')) {
        return await handleWeatherRoute(req, res, url);
      }
      if (pathname === '/api/dossier' || pathname.startsWith('/api/dossier/') || pathname === '/api/v1/iap' || pathname.startsWith('/api/v1/iap/')) {
        return await handleDossierRoute(req, res, url);
      }
      if (pathname === '/api/simulation' || pathname.startsWith('/api/simulation/')) {
        return await handleSimulationRoute(req, res, url);
      }
      if (pathname === '/api/alerts' || pathname.startsWith('/api/alerts/') || pathname.startsWith('/api/v1/alerts/')) {
        return await handleAlertsRoute(req, res, url);
      }
      if (pathname === '/api/agni' || pathname.startsWith('/api/agni/') || pathname === '/api/v1/agni' || pathname.startsWith('/api/v1/agni/')) {
        return await handleAgniRoute(req, res, url);
      }

      // 7. 404 Unified Error for unknown or purged routes
      return sendError(res, 404, 'ROUTE_NOT_FOUND', `Endpoint not found or out-of-scope: ${pathname}`, [], req);
    } catch (err) {
      console.error(`[FIRMS API Error | Trace: ${req.traceId}]`, err);
      return sendError(
        res,
        500,
        'INTERNAL_SERVER_ERROR',
        'An error occurred processing the thermal anomaly request',
        process.env.NODE_ENV === 'development' ? [err?.message || String(err)] : [],
        req
      );
    }
  };
}
