/**
 * @module server/routes/industrial
 * @description Industrial facilities and HazMat GIS API route handler.
 */

import { getAllFacilities, findFacilitiesNearby, getFacilityById, getHazmatProfiles } from '../../src/disasters/industrial/industrialFacilities.js';
import { createRateLimiter } from '../services/rateLimit.mjs';
import { sendJson, getClientIp } from '../middleware/security.mjs';

const rateLimiter = createRateLimiter({ maxTokens: 120, refillIntervalMs: 60000 });

export async function handleIndustrialRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/industrial/, '');

  // 1. GET /api/industrial/hazmat
  if (pathname === '/hazmat') {
    return sendJson(res, 200, {
      profiles: getHazmatProfiles(),
    });
  }

  // 2. GET /api/industrial/nearby?lat=...&lon=...&radiusKm=...
  if (pathname === '/nearby') {
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const radiusKm = Number(url.searchParams.get('radiusKm') || 25);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return sendJson(res, 400, { error: 'Invalid coordinates: lat and lon are required' });
    }

    const nearby = findFacilitiesNearby(lat, lon, radiusKm);
    return sendJson(res, 200, {
      query: { lat, lon, radiusKm },
      count: nearby.length,
      facilities: nearby,
    });
  }

  // 3. GET /api/industrial/facilities
  if (pathname === '/facilities' || pathname === '' || pathname === '/') {
    const all = getAllFacilities();
    return sendJson(res, 200, {
      count: all.length,
      facilities: all,
    });
  }

  // 4. GET /api/industrial/facility/:id
  const facilityMatch = pathname.match(/^\/facility\/(.+)$/);
  if (facilityMatch) {
    const id = facilityMatch[1];
    const fac = getFacilityById(id);
    if (!fac) return sendJson(res, 404, { error: `Facility '${id}' not found` });
    return sendJson(res, 200, { facility: fac });
  }

  return sendJson(res, 404, { error: 'Endpoint Not Found under /api/industrial' });
}
