/**
 * @module server/routes/hazmat
 * @description API route handler for Expanded NOAA CAMEO & NIOSH HazMat Chemical Registry.
 */

import { cameoHazmatRegistry } from '../../src/hazmat/cameoHazmatRegistry.js';
import { sendJson, sendError } from '../middleware/security.mjs';

export async function handleHazmatRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/v1\/hazmat/, '');

  // 1. Search Chemicals: GET /api/v1/hazmat/chemicals?q=...
  if (pathname === '/chemicals' || pathname === '/search') {
    const q = url.searchParams.get('q') || url.searchParams.get('query');
    if (!q) {
      return sendJson(res, 200, {
        success: true,
        count: cameoHazmatRegistry.chemicals.length,
        chemicals: cameoHazmatRegistry.chemicals,
        metadata: cameoHazmatRegistry.getRegistryMetadata()
      }, { 'Cache-Control': 'public, max-age=3600' }, req);
    }

    const matches = cameoHazmatRegistry.search(q);
    return sendJson(res, 200, {
      success: true,
      query: q,
      count: matches.length,
      chemicals: matches
    }, { 'Cache-Control': 'public, max-age=120' }, req);
  }

  // 2. Chemical Detail by ID / UN: GET /api/v1/hazmat/chemicals/:idOrUn
  const chemMatch = pathname.match(/^\/chemicals\/([a-zA-Z0-9_-]+)$/);
  if (chemMatch) {
    const idOrUn = chemMatch[1];
    const chem = cameoHazmatRegistry.getChemical(idOrUn);
    if (!chem) {
      return sendError(res, 404, 'CHEMICAL_NOT_FOUND', `Chemical with ID or UN identifier '${idOrUn}' not found in registry.`, [], req);
    }
    return sendJson(res, 200, {
      success: true,
      chemical: chem
    }, { 'Cache-Control': 'public, max-age=3600' }, req);
  }

  // 3. Associated Chemicals by Facility Sector: GET /api/v1/hazmat/facility-chemicals?sector=...
  if (pathname === '/facility-chemicals' || pathname === '/sector') {
    const sector = url.searchParams.get('sector');
    if (!sector) {
      return sendError(res, 400, 'MISSING_SECTOR', 'Parameter sector is required.', [], req);
    }
    const chemicals = cameoHazmatRegistry.getChemicalsForSector(sector);
    return sendJson(res, 200, {
      success: true,
      sector,
      count: chemicals.length,
      chemicals,
      association_disclaimer: 'Chemical inventory reflects typical sector industrial baselines; not a direct chemical sensor measurement.'
    }, { 'Cache-Control': 'public, max-age=3600' }, req);
  }

  // 4. Registry Metadata: GET /api/v1/hazmat/registry
  if (pathname === '/registry' || pathname === '/metadata') {
    return sendJson(res, 200, {
      success: true,
      ...cameoHazmatRegistry.getRegistryMetadata()
    }, { 'Cache-Control': 'public, max-age=3600' }, req);
  }

  return sendError(res, 404, 'ROUTE_NOT_FOUND', `Hazmat route endpoint not found: ${pathname}`, [], req);
}
