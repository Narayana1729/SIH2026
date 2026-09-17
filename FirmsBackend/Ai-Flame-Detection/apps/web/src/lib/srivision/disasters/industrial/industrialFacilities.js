/**
 * @module src/disasters/industrial/industrialFacilities
 * @description Industrial facilities GIS database and HazMat risk query engine.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineDistanceKm } from '../../core/geospatial.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data/local_data/industrial');

let cachedFacilities = null;
let cachedHazmatProfiles = null;

/**
 * Load HazMat profiles dictionary.
 */
export function getHazmatProfiles() {
  if (cachedHazmatProfiles) return cachedHazmatProfiles;
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'hazmat_profiles.json'), 'utf8');
    cachedHazmatProfiles = JSON.parse(raw);
  } catch {
    cachedHazmatProfiles = {};
  }
  return cachedHazmatProfiles;
}

/**
 * Load all industrial facilities from GeoJSON.
 */
export function getAllFacilities() {
  if (cachedFacilities) return cachedFacilities;
  try {
    const geojsonPath = path.join(DATA_DIR, 'master_india_industrial_facilities.geojson');
    const raw = fs.readFileSync(geojsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const features = parsed.features || [];

    cachedFacilities = features.map((f, index) => {
      const coords = f.geometry?.coordinates || [0, 0];
      const props = f.properties || {};
      const lon = coords[0];
      const lat = coords[1];
      return {
        id: props.id || props.facility_id || `facility-${index + 1}`,
        name: props.name || props.facility_name || 'Industrial Facility',
        sector: props.sector || props.industry_type || 'Industrial Complex',
        hazard_rating: props.hazard_rating || props.risk_level || 'MEDIUM',
        state: props.state || '',
        district: props.district || '',
        latitude: lat,
        longitude: lon,
        properties: props,
      };
    });
  } catch (err) {
    console.error('[Industrial Facilities] Error loading GeoJSON:', err.message);
    cachedFacilities = [];
  }
  return cachedFacilities;
}

/**
 * Find industrial facilities within a given radius of a point.
 * @param {number} lat 
 * @param {number} lon 
 * @param {number} [radiusKm=25] 
 * @returns {Array<Object>}
 */
export function findFacilitiesNearby(lat, lon, radiusKm = 25) {
  const all = getAllFacilities();
  const hazmat = getHazmatProfiles();
  const nearby = [];

  for (const fac of all) {
    const dist = haversineDistanceKm(lat, lon, fac.latitude, fac.longitude);
    if (dist <= radiusKm) {
      const hazmatInfo = hazmat[fac.sector] || null;
      nearby.push({
        ...fac,
        distance_km: Math.round(dist * 100) / 100,
        hazmat_profile: hazmatInfo,
        isolation_distance_meters: hazmatInfo?.initial_isolation_distance_meters || 500,
        primary_disaster_risk: hazmatInfo?.primary_disaster_risk || 'Thermal Ignition / Industrial Smoke',
      });
    }
  }

  nearby.sort((a, b) => a.distance_km - b.distance_km);

  return nearby;
}

/**
 * Get facility by unique ID.
 */
export function getFacilityById(id) {
  const all = getAllFacilities();
  const found = all.find((f) => f.id === id);
  if (!found) return null;
  const hazmat = getHazmatProfiles();
  return {
    ...found,
    hazmat_profile: hazmat[found.sector] || null,
  };
}
