/**
 * @module server/routes/dossier
 * @description Tactical Disaster Incident Dossier API route handler.
 */

import { generateIncidentDossier } from '../../src/intelligence/dossierGenerator.js';
import { createRateLimiter } from '../services/rateLimit.mjs';
import { sendJson, getClientIp } from '../middleware/security.mjs';

const rateLimiter = createRateLimiter({ maxTokens: 60, refillIntervalMs: 60000 });

export async function handleDossierRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/dossier/, '');

  // POST /api/dossier/generate or GET /api/dossier/generate
  if (pathname === '/generate' || pathname === '' || pathname === '/') {
    let incident = {};

    if (req.method === 'POST') {
      let bodyRaw = '';
      for await (const chunk of req) bodyRaw += chunk;
      try { incident = JSON.parse(bodyRaw || '{}'); } catch {}
    } else {
      incident = {
        id: url.searchParams.get('id') || `INC-${Date.now()}`,
        type: url.searchParams.get('type') || 'WILDFIRE',
        latitude: Number(url.searchParams.get('lat') || 0),
        longitude: Number(url.searchParams.get('lon') || 0),
        severity: url.searchParams.get('severity') || 'HIGH',
        frp: Number(url.searchParams.get('frp') || 100),
        radiusKm: Number(url.searchParams.get('radiusKm') || 25),
        weather: {
          windSpeedKmh: Number(url.searchParams.get('windSpeed') || 20),
          windDirectionDeg: Number(url.searchParams.get('windDir') || 270),
          relativeHumidity: Number(url.searchParams.get('humidity') || 25),
        },
      };
    }

    if (incident.latitude === undefined || incident.longitude === undefined || Number.isNaN(Number(incident.latitude)) || Number.isNaN(Number(incident.longitude))) {
      return sendJson(res, 400, { error: 'Invalid coordinates: latitude and longitude are required' });
    }

    const dossier = generateIncidentDossier(incident);
    return sendJson(res, 200, { success: true, dossier });
  }

  return sendJson(res, 404, { error: 'Endpoint Not Found under /api/dossier' });
}
