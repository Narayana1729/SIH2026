/**
 * @module server/routes/dispersion
 * @description Gaussian Plume toxic dispersion simulation API route handler.
 */

import { generatePlumeFootprint, calculateGroundConcentration, estimateStabilityClass } from '../../src/disasters/dispersion/gaussianPlume.js';
import { findFacilitiesNearby, resolveHazmatProfile } from '../../src/disasters/industrial/industrialFacilities.js';
import { createRateLimiter } from '../services/rateLimit.mjs';
import { sendJson, getClientIp } from '../middleware/security.mjs';

const rateLimiter = createRateLimiter({ maxTokens: 60, refillIntervalMs: 60000 });

export async function handleDispersionRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/dispersion/, '');

  // POST /api/dispersion/plume or GET /api/dispersion/plume
  if (pathname === '/plume' || pathname === '') {
    let params = {};

    if (req.method === 'POST') {
      let bodyRaw = '';
      for await (const chunk of req) bodyRaw += chunk;
      try { params = JSON.parse(bodyRaw || '{}'); } catch {}
    } else {
      params = {
        sourceLat: Number(url.searchParams.get('lat')),
        sourceLon: Number(url.searchParams.get('lon')),
        windDirectionDeg: Number(url.searchParams.get('windDir') || 270),
        windSpeedMps: Number(url.searchParams.get('windSpeed') || 4),
        emissionRateGps: Number(url.searchParams.get('emissionRate') || 500),
        stabilityClass: url.searchParams.get('stability') || 'D',
        maxDistanceKm: Number(url.searchParams.get('maxDistKm') || 15),
      };
    }

    const {
      sourceLat = params.originLat ?? params.lat,
      sourceLon = params.originLon ?? params.lon,
      windDirectionDeg = params.windDirectionDegrees ?? params.windDir ?? 270,
      windSpeedMps = params.windSpeedMs ?? params.windSpeed ?? 4,
      emissionRateGps = params.emissionRateGPerSec ?? params.emissionRate ?? 500,
      effectiveHeightMeters = 15,
      maxDistanceKm = 15,
      stabilityClass = 'D',
    } = params;

    if (sourceLat === undefined || sourceLon === undefined || Number.isNaN(Number(sourceLat)) || Number.isNaN(Number(sourceLon))) {
      return sendJson(res, 400, { error: 'Invalid coordinates: sourceLat and sourceLon are required' });
    }

    // Cross-reference nearby industrial infrastructure to obtain authentic CAMEO/NIOSH HazMat profile
    const nearby = findFacilitiesNearby(Number(sourceLat), Number(sourceLon), 30);
    const matchedFacility = nearby[0] || null;
    const hazmat = matchedFacility?.hazmat_profile || (params.sector ? resolveHazmatProfile(params.sector) : null);

    // Resolve chemical name & realistic IDLH/ERPG thresholds
    let chemicalName = params.chemicalName || params.chemical;
    let thresholds = params.thresholds;

    if (!chemicalName) {
      chemicalName = hazmat?.default_dispersion_chemical || 'Toxic Vapor';
    }
    if (!thresholds) {
      thresholds = hazmat?.dispersion_thresholds || { advisory: 1.0, evacuation: 10.0, critical: 50.0 };
    }

    const result = generatePlumeFootprint({
      sourceLat: Number(sourceLat),
      sourceLon: Number(sourceLon),
      windDirectionDeg: Number(windDirectionDeg),
      windSpeedMps: Number(windSpeedMps),
      emissionRateGps: Number(emissionRateGps),
      effectiveHeightMeters: Number(effectiveHeightMeters),
      maxDistanceKm: Number(maxDistanceKm),
      stabilityClass: String(stabilityClass).toUpperCase(),
      chemicalName: String(chemicalName),
      thresholds: thresholds,
    });

    const responsePayload = {
      success: true,
      data: result,
      ...result,
      hazmat_intelligence: hazmat ? {
        matched_facility: matchedFacility ? {
          id: matchedFacility.id,
          name: matchedFacility.name,
          sector: matchedFacility.sector,
          distance_km: matchedFacility.distance_km,
        } : null,
        primary_chemicals: hazmat.primary_chemicals || [],
        un_na_numbers: hazmat.un_na_numbers || [],
        cameo_hazmat_class: hazmat.cameo_hazmat_class || '',
        primary_disaster_risk: hazmat.primary_disaster_risk || '',
        initial_isolation_distance_meters: hazmat.initial_isolation_distance_meters || 800,
        downwind_evacuation_day_meters: hazmat.downwind_evacuation_day_meters || 1600,
        downwind_evacuation_night_meters: hazmat.downwind_evacuation_night_meters || 2400,
        toxic_combustion_byproducts: hazmat.toxic_combustion_byproducts || [],
        firefighting_protocol: hazmat.firefighting_protocol || '',
        idlh_ppm: hazmat.idlh_ppm || {},
      } : null,
    };

    return sendJson(res, 200, responsePayload);
  }

  return sendJson(res, 404, { error: 'Endpoint Not Found under /api/dispersion' });
}

