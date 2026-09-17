/**
 * @module server/middleware/auth
 * @description API Key authentication middleware for PyroSat endpoints.
 *
 * In production, validates requests against the PYROSAT_API_KEY environment variable.
 * In development mode (APP_ENV=development), allows unauthenticated access with a warning header.
 *
 * Usage: Attach to the middleware chain before route handlers.
 */

import { sendError } from './security.mjs';

const DEV_MODE = (process.env.APP_ENV || 'development') === 'development';

/**
 * Validates API key from Authorization header or X-API-Key header.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true if authenticated (or dev mode bypass), false if rejected
 */
export function authenticateRequest(req, res) {
  // Health and metrics endpoints are always public
  const url = req.url || '/';
  if (url === '/healthz' || url === '/readyz' || url.startsWith('/api/health') || url === '/api/metrics') {
    return true;
  }

  const configuredKey = process.env.PYROSAT_API_KEY;

  // Dev mode: allow unauthenticated access but set warning header
  if (DEV_MODE || !configuredKey) {
    res.setHeader('X-Auth-Warning', 'No authentication enforced (development mode)');
    return true;
  }

  // Extract key from Authorization: Bearer <key> or X-API-Key header
  const authHeader = req.headers?.['authorization'] || '';
  const xApiKey = req.headers?.['x-api-key'] || '';

  let providedKey = '';
  if (authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7).trim();
  } else if (xApiKey) {
    providedKey = xApiKey.trim();
  }

  if (!providedKey) {
    sendError(res, 401, 'AUTHENTICATION_REQUIRED', 'Missing API key. Provide via Authorization: Bearer <key> or X-API-Key header.', [], req);
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== configuredKey.length || !timingSafeEqual(providedKey, configuredKey)) {
    sendError(res, 403, 'INVALID_API_KEY', 'The provided API key is invalid.', [], req);
    return false;
  }

  return true;
}

/**
 * Constant-time string comparison (not crypto-grade but prevents trivial timing attacks).
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
