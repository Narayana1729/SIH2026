/**
 * @module server/routes/simulation
 * @description Physics-informed wildfire Rothermel spread simulation API handler.
 */

import { simulateFirePerimeters } from '../../src/disasters/wildfire/fireSpreadSimulation.js';
import { createRateLimiter } from '../services/rateLimit.mjs';
import { sendJson, getClientIp } from '../middleware/security.mjs';

const rateLimiter = createRateLimiter({ maxTokens: 60, refillIntervalMs: 60000 });

export async function handleSimulationRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/simulation/, '');

  // 1. Interactive What-If Scenario Lab: POST or GET /api/simulation/what-if
  if (pathname === '/what-if' || pathname === '/scenario') {
    let params = {};

    if (req.method === 'POST') {
      let bodyRaw = '';
      for await (const chunk of req) bodyRaw += chunk;
      try { params = JSON.parse(bodyRaw || '{}'); } catch {}
    } else {
      params = {
        latitude: Number(url.searchParams.get('lat') || url.searchParams.get('latitude') || 0),
        longitude: Number(url.searchParams.get('lon') || url.searchParams.get('longitude') || 0),
        windSpeedMps: Number(url.searchParams.get('windSpeedMps') || url.searchParams.get('wind_speed_mps') || 5.0),
        windDirectionDeg: Number(url.searchParams.get('windDir') || url.searchParams.get('wind_direction_deg') || 240.0),
        frpMw: Number(url.searchParams.get('frp') || url.searchParams.get('frp_mw') || 50.0),
        scenarioMode: url.searchParams.get('scenario') || url.searchParams.get('scenarioMode') || 'BASELINE',
        chemicalName: url.searchParams.get('chemical') || 'Toxic Industrial Vapor'
      };
    }

    const lat = params.latitude ?? params.lat ?? params.originLat;
    const lon = params.longitude ?? params.lon ?? params.originLon;

    if (lat === undefined || lon === undefined || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
      return sendJson(res, 400, { success: false, error: 'latitude and longitude are required' }, {}, req);
    }

    const { runWhatIfSimulation } = await import('../../src/simulation/incidentSimulationLab.js');
    const simResult = runWhatIfSimulation({
      latitude: Number(lat),
      longitude: Number(lon),
      windSpeedMps: Number(params.windSpeedMps || params.wind_speed_mps || (Number(params.windSpeedKmh || 20) / 3.6)),
      windDirectionDeg: Number(params.windDirectionDeg || params.windDir || 240.0),
      frpMw: Number(params.frpMw || params.frp || 50.0),
      scenarioMode: params.scenarioMode || params.scenario || 'BASELINE',
      chemicalName: params.chemicalName || 'Toxic Industrial Vapor',
      fuelCategory: params.fuelCategory || params.fuelType || 'TIMBER_LITTER'
    });

    return sendJson(res, 200, {
      success: true,
      data: simResult
    }, { 'Cache-Control': 'no-store' }, req);
  }

  if (pathname === '/spread' || pathname === '') {
    let params = {};

    if (req.method === 'POST') {
      let bodyRaw = '';
      for await (const chunk of req) bodyRaw += chunk;
      try { params = JSON.parse(bodyRaw || '{}'); } catch {}
    } else {
      params = {
        originLat: Number(url.searchParams.get('lat') || url.searchParams.get('originLat')),
        originLon: Number(url.searchParams.get('lon') || url.searchParams.get('originLon')),
        windSpeedKmh: Number(url.searchParams.get('windSpeed') || 20),
        windDirDegrees: Number(url.searchParams.get('windDir') || 220),
        slopeDegrees: Number(url.searchParams.get('slope') || 10),
        fuelType: url.searchParams.get('fuel') || 'SHRUB_BRUSH',
      };
    }

    const lat = params.originLat ?? params.lat ?? params.latitude;
    const lon = params.originLon ?? params.lon ?? params.longitude;

    if (lat === undefined || lon === undefined || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
      return sendJson(res, 400, { success: false, error: 'originLat and originLon are required' });
    }

    const sim = simulateFirePerimeters({
      originLat: Number(lat),
      originLon: Number(lon),
      windSpeedKmh: Number(params.windSpeedKmh || params.windSpeed || 20),
      windDirDegrees: Number(params.windDirDegrees || params.windDir || 220),
      slopeDegrees: Number(params.slopeDegrees || params.slope || 10),
      fuelType: params.fuelType || 'SHRUB_BRUSH',
      hours: params.hours || [1, 2, 4],
    });

    // Ensure `coordinates` is present directly on perimeters for UI rendering
    if (sim?.perimeters) {
      for (const p of sim.perimeters) {
        if (!p.coordinates && p.polygon_geojson?.geometry?.coordinates?.[0]) {
          p.coordinates = p.polygon_geojson.geometry.coordinates[0];
        }
      }
    }

    return sendJson(res, 200, {
      success: true,
      data: sim,
    });
  }

  return sendJson(res, 404, { error: 'Unknown simulation endpoint' });
}
