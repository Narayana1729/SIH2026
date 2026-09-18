/**
 * @module server/routes/gisLayers
 * @description API route handler for Critical-Infrastructure GIS Layer Registry & Spatial Intersections.
 */

import { infrastructureRegistry } from '../../src/gis/infrastructureRegistry.js';
import { sendJson, sendError } from '../middleware/security.mjs';

export async function handleGisLayersRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/v1\/gis/, '');

  // 1. Layer Catalog: GET /api/v1/gis/layers
  if (pathname === '/layers' || pathname === '/catalog') {
    const layers = infrastructureRegistry.getAllLayers();
    return sendJson(res, 200, {
      success: true,
      count: layers.length,
      layers
    }, { 'Cache-Control': 'public, max-age=3600' }, req);
  }

  // 2. Layer GeoJSON: GET /api/v1/gis/layers/:layerId/geojson
  const layerMatch = pathname.match(/^\/layers\/([a-zA-Z0-9_-]+)(?:\/geojson)?$/);
  if (layerMatch) {
    const layerId = layerMatch[1];
    const layer = infrastructureRegistry.getLayer(layerId);
    if (!layer || !layer.data) {
      return sendError(res, 404, 'LAYER_NOT_FOUND', `Infrastructure layer '${layerId}' does not exist.`, [], req);
    }
    return sendJson(res, 200, layer.data, { 'Cache-Control': 'public, max-age=3600' }, req);
  }

  // 3. Infrastructure Risk Intersection: GET /api/v1/gis/intersection
  if (pathname === '/intersection' || pathname === '/intersect') {
    const latStr = url.searchParams.get('lat') || url.searchParams.get('latitude');
    const lonStr = url.searchParams.get('lon') || url.searchParams.get('longitude');

    if (!latStr || !lonStr) {
      return sendError(res, 400, 'MISSING_COORDINATES', 'Parameters lat and lon are required.', [], req);
    }

    const lat = Number(latStr);
    const lon = Number(lonStr);

    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return sendError(res, 400, 'INVALID_COORDINATES', `Invalid WGS84 coordinates: lat=${latStr}, lon=${lonStr}`, [], req);
    }

    const radiusKm = Number(url.searchParams.get('radius_km') || 15.0);
    const result = infrastructureRegistry.findIntersectingInfrastructure(lat, lon, radiusKm);

    return sendJson(res, 200, {
      success: true,
      data: result
    }, { 'Cache-Control': 'public, max-age=60' }, req);
  }

  return sendError(res, 404, 'ROUTE_NOT_FOUND', `GIS route endpoint not found: ${pathname}`, [], req);
}
