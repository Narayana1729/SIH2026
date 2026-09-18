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

  // 1. Official Multi-Page Incident Action Plan PDF: POST or GET /api/dossier/pdf or /api/v1/iap/pdf
  if (pathname === '/pdf' || pathname === '/iap/pdf' || pathname === '/export/pdf') {
    let incident = {};

    if (req.method === 'POST') {
      let bodyRaw = '';
      for await (const chunk of req) bodyRaw += chunk;
      try { incident = JSON.parse(bodyRaw || '{}'); } catch {}
    } else {
      incident = {
        id: url.searchParams.get('id') || `INC-${Date.now()}`,
        title: url.searchParams.get('title') || url.searchParams.get('name') || 'Thermal Anomaly Incident',
        type: url.searchParams.get('type') || 'WILDFIRE',
        latitude: Number(url.searchParams.get('lat') || url.searchParams.get('latitude') || 0),
        longitude: Number(url.searchParams.get('lon') || url.searchParams.get('longitude') || 0),
        frp: Number(url.searchParams.get('frp') || url.searchParams.get('frp_mw') || 45),
        flameTempK: Number(url.searchParams.get('flameTempK') || 890),
        burnAreaM2: Number(url.searchParams.get('burnAreaM2') || 140),
        severity: url.searchParams.get('severity') || 'HIGH',
        weather: {
          windSpeedKmh: Number(url.searchParams.get('windSpeedKmh') || 18),
          windDirectionDeg: Number(url.searchParams.get('windDirectionDeg') || 240),
          temperatureC: Number(url.searchParams.get('temperatureC') || 31),
          humidityPercent: Number(url.searchParams.get('humidityPercent') || 28),
        }
      };
    }

    try {
      const { generateIncidentActionPlanPdf } = await import('../services/pdfIapGenerator.mjs');
      const pdfBuffer = await generateIncidentActionPlanPdf(incident);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="Incident_Action_Plan_${incident.id || 'TACTICAL'}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.end(pdfBuffer);
      return;
    } catch (err) {
      console.error('[PDF Generation Error]', err);
      return sendJson(res, 500, { success: false, error: 'Failed to generate Incident Action Plan PDF', details: err.message }, {}, req);
    }
  }

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
