/**
 * @module server/routes/protectedAreas
 * @description API route handler for Protected-Area & Forest Threat Intelligence.
 */

import { evaluateProtectedAreaThreat, AUTHORITATIVE_PROTECTED_AREAS, calculatePointToPolygonDistanceKm, classifyThreatBand } from '../../src/services/protectedAreasService.js';
import { sendJson, sendError } from '../middleware/security.mjs';

export async function handleProtectedAreasRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/v1\/protected-areas/, '');

  // 1. Point Threat Assessment: GET /api/v1/protected-areas/evaluate
  if (pathname === '/evaluate' || pathname === '/threat') {
    const latStr = url.searchParams.get('lat') || url.searchParams.get('latitude');
    const lonStr = url.searchParams.get('lon') || url.searchParams.get('longitude');

    if (!latStr || !lonStr) {
      return sendError(res, 400, 'MISSING_COORDINATES', 'Query parameters lat and lon are required.', [], req);
    }

    const lat = Number(latStr);
    const lon = Number(lonStr);

    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return sendError(res, 400, 'INVALID_COORDINATES', `Coordinates out of WGS84 bounds: lat=${latStr}, lon=${lonStr}`, [], req);
    }

    const radiusKm = Number(url.searchParams.get('radius_km') || url.searchParams.get('threat_radius_km') || 100.0);
    const assessment = evaluateProtectedAreaThreat(lat, lon, { searchRadiusKm: radiusKm });

    return sendJson(res, 200, {
      success: true,
      data: assessment
    }, { 'Cache-Control': 'public, max-age=60' }, req);
  }

  // 2. Nearby Reserves: GET /api/v1/protected-areas/nearby
  if (pathname === '/nearby' || pathname === '') {
    const latStr = url.searchParams.get('lat') || url.searchParams.get('latitude');
    const lonStr = url.searchParams.get('lon') || url.searchParams.get('longitude');

    if (!latStr || !lonStr) {
      return sendError(res, 400, 'MISSING_COORDINATES', 'Query parameters lat and lon are required.', [], req);
    }

    const lat = Number(latStr);
    const lon = Number(lonStr);
    const radiusKm = Number(url.searchParams.get('radius_km') || 50.0);

    const items = [];
    for (const pa of AUTHORITATIVE_PROTECTED_AREAS) {
      const distKm = calculatePointToPolygonDistanceKm(lat, lon, pa.coordinates);
      if (distKm <= radiusKm) {
        const threat = classifyThreatBand(distKm);
        items.push({
          id: pa.id,
          name: pa.name,
          type: pa.type,
          state: pa.state,
          distance_km: distKm,
          threat_level: threat.level,
          threat_band: threat.band,
          area_km2: pa.area_km2,
          centroid: pa.centroid
        });
      }
    }

    items.sort((a, b) => a.distance_km - b.distance_km);

    return sendJson(res, 200, {
      success: true,
      count: items.length,
      data: items
    }, {}, req);
  }

  // 3. Catalog GeoJSON: GET /api/v1/protected-areas/catalog
  if (pathname === '/catalog' || pathname === '/geojson') {
    const features = AUTHORITATIVE_PROTECTED_AREAS.map(pa => ({
      type: 'Feature',
      id: pa.id,
      properties: {
        id: pa.id,
        name: pa.name,
        short_name: pa.short_name,
        type: pa.type,
        state: pa.state,
        area_km2: pa.area_km2,
        primary_biome: pa.primary_biome,
        source: pa.source
      },
      geometry: {
        type: 'Polygon',
        coordinates: pa.coordinates
      }
    }));

    return sendJson(res, 200, {
      type: 'FeatureCollection',
      metadata: {
        provider: 'Forest Survey of India / Wildlife Institute of India',
        total_reserves: features.length
      },
      features
    }, { 'Cache-Control': 'public, max-age=3600' }, req);
  }

  return sendError(res, 404, 'ROUTE_NOT_FOUND', `Protected areas endpoint not found: ${pathname}`, [], req);
}
