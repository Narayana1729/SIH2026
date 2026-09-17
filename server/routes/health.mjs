/**
 * @module server/routes/health
 * @description Production Kubernetes/Cloud Run Health Probes & Telemetry Routes.
 */

import { sendJson, sendError } from '../middleware/security.mjs';
import { metricsRegistry } from '../services/metrics.mjs';
import { defaultCache } from '../services/cache.mjs';
import { firmsCircuitBreaker, usgsCircuitBreaker, openMeteoCircuitBreaker } from '../services/circuitBreaker.mjs';
import { defaultMLInferenceService } from '../services/mlInferenceService.mjs';

/**
 * Handles Liveness Probes (/healthz, /api/health/live).
 */
export async function handleLivenessRoute(req, res) {
  return sendJson(
    res,
    200,
    {
      status: 'LIVE',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {},
    req
  );
}

/**
 * Handles Readiness Probes (/readyz, /api/health/ready).
 */
export async function handleReadinessRoute(req, res) {
  const checks = {
    cacheWritable: false,
    circuitBreakers: {
      firms: firmsCircuitBreaker.getStatus(),
      usgs: usgsCircuitBreaker.getStatus(),
      openMeteo: openMeteoCircuitBreaker.getStatus(),
    },
    mlRuntime: {
      ready: defaultMLInferenceService.isReady,
      mode: defaultMLInferenceService.isReady ? 'ACTIVE' : 'FALLBACK',
    },
    nodeVersion: process.version,
  };

  try {
    // Verify cache storage readiness
    const testKey = `.health_probe_${Date.now()}.tmp`;
    const writeOk = await defaultCache.set(testKey, 'ok');
    checks.cacheWritable = writeOk;
  } catch (err) {
    checks.cacheWritable = false;
    checks.cacheError = err?.message || String(err);
  }

  const isReady = checks.cacheWritable;
  const statusCode = isReady ? 200 : 503;

  return sendJson(
    res,
    statusCode,
    {
      status: isReady ? 'READY' : 'DEGRADED',
      checks,
      timestamp: new Date().toISOString(),
    },
    {},
    req
  );
}

/**
 * Handles Metrics route (/api/metrics).
 */
export async function handleMetricsRoute(req, res) {
  const snapshot = metricsRegistry.getSnapshot();
  return sendJson(res, 200, snapshot, {}, req);
}
