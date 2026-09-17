/**
 * @module server/middleware/security
 * @description Production security middleware providing SSRF protection, DNS rebinding checks,
 * HTTP security headers, ETag validation, and unified error responses.
 */

import { lookup as lookupDns } from 'node:dns/promises';
import crypto from 'node:crypto';

/**
 * Computes the allowed CORS origin for a request.
 * In dev mode, allows localhost origins. In production, reads PYROSAT_ALLOWED_ORIGINS.
 * @param {import('http').IncomingMessage} req
 * @returns {string} The origin to set, or empty string to deny
 */
function getAllowedOrigin(req) {
  const requestOrigin = req?.headers?.origin || '';
  const envOrigins = process.env.PYROSAT_ALLOWED_ORIGINS;
  const isDev = (process.env.APP_ENV || 'development') === 'development';

  // Dev mode: allow common local origins
  if (isDev) {
    const devOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:5173'];
    if (!requestOrigin || devOrigins.some(o => requestOrigin.startsWith(o))) {
      return requestOrigin || '*';
    }
    return requestOrigin; // Allow any origin in dev for convenience
  }

  // Production: check allowlist
  if (envOrigins) {
    const allowed = envOrigins.split(',').map(s => s.trim());
    if (allowed.includes(requestOrigin)) return requestOrigin;
  }

  return ''; // Deny
}

/**
 * Checks whether an IP address is a private, loopback, or link-local address.
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  const clean = ip.trim();

  // IPv4 checks
  if (clean === 'localhost' || clean === '127.0.0.1' || clean === '0.0.0.0') return true;
  if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  if (clean.startsWith('169.254.')) return true; // Link-local

  // IPv6 checks
  if (clean === '::1' || clean === '::') return true;
  if (clean.toLowerCase().startsWith('fe80:')) return true; // Link-local IPv6
  if (clean.toLowerCase().startsWith('fc00:') || clean.toLowerCase().startsWith('fd00:')) return true;

  return false;
}

/**
 * Validates upstream URL host against SSRF and private IP ranges.
 * @param {string} targetUrl
 * @returns {Promise<boolean>}
 */
export async function validateUpstreamUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Resolve DNS
    const res = await lookupDns(parsed.hostname);
    if (!res?.address || isPrivateIp(res.address)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Computes an ETag hash for any JSON serializable payload.
 * @param {any} data
 * @returns {string}
 */
export function computeEtag(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('sha1').update(content).digest('base64url').slice(0, 27);
  return `W/"${hash}"`;
}

/**
 * Sends a standardized JSON response with production security headers and ETag support.
 */
export function sendJson(res, status, obj, headers = {}, req = null) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const etag = headers['ETag'] || computeEtag(body);

  // Check If-None-Match header from client
  if (req && req.headers && req.headers['if-none-match'] === etag && status === 200) {
    const corsOrigin304 = getAllowedOrigin(req);
    res.writeHead(304, {
      'ETag': etag,
      ...(corsOrigin304 ? { 'Access-Control-Allow-Origin': corsOrigin304 } : {}),
      'X-Content-Type-Options': 'nosniff',
      'X-Request-ID': req.traceId || headers['X-Request-ID'] || '',
      ...headers,
    });
    return res.end();
  }

  const corsOrigin = getAllowedOrigin(req);
  const responseHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...(corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Request-ID, If-None-Match',
    'Vary': 'Origin',
    'ETag': etag,
    ...headers,
  };

  if (req?.traceId) {
    responseHeaders['X-Request-ID'] = req.traceId;
  }

  res.writeHead(status, responseHeaders);
  res.end(body);
}

/**
 * Sends a standardized Production Error Envelope.
 */
export function sendError(res, status, code, message, details = [], req = null, extraHeaders = {}) {
  const traceId = req?.traceId || (req?.headers ? req.headers['x-request-id'] : null) || crypto.randomUUID();

  return sendJson(
    res,
    status,
    {
      error: {
        code,
        message,
        details: Array.isArray(details) ? details : [details],
        traceId,
      },
    },
    { 'X-Request-ID': traceId, ...extraHeaders },
    req
  );
}

/**
 * Extracts client IP from request.
 */
export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}
