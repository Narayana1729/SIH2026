import { haversineDistanceKm } from '../../core/geospatial.js';
import { HAZMAT_PROFILES, resolveHazmatProfile } from './hazmatProfiles.js';
import { MASTER_FACILITIES } from './facilitiesData.js';

let cachedFacilities = null;

export { HAZMAT_PROFILES, resolveHazmatProfile };

/**
 * Load HazMat profiles dictionary.
 */
export function getHazmatProfiles() {
  return HAZMAT_PROFILES;
}

/**
 * Load all industrial facilities (full 2,087 national and regional registry).
 */
export function getAllFacilities() {
  if (cachedFacilities) return cachedFacilities;
  cachedFacilities = MASTER_FACILITIES;
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
  const nearby = [];

  for (const fac of all) {
    const dist = haversineDistanceKm(lat, lon, fac.latitude, fac.longitude);
    if (dist <= radiusKm) {
      const hazmatInfo = resolveHazmatProfile(fac);
      nearby.push({
        ...fac,
        distance_km: Math.round(dist * 100) / 100,
        hazmat_profile: hazmatInfo,
        isolation_distance_meters: hazmatInfo?.initial_isolation_distance_meters || 800,
        downwind_evacuation_day_meters: hazmatInfo?.downwind_evacuation_day_meters || 1600,
        downwind_evacuation_night_meters: hazmatInfo?.downwind_evacuation_night_meters || 2400,
        un_na_numbers: hazmatInfo?.un_na_numbers || [],
        primary_chemicals: hazmatInfo?.primary_chemicals || [],
        toxic_combustion_byproducts: hazmatInfo?.toxic_combustion_byproducts || [],
        firefighting_protocol: hazmatInfo?.firefighting_protocol || '',
        primary_disaster_risk: hazmatInfo?.primary_disaster_risk || 'Thermal Ignition / Industrial Process Heat',
      });
    }
  }

  nearby.sort((a, b) => a.distance_km - b.distance_km);

  return nearby;
}

/**
 * Get facility by unique ID with full HazMat profile.
 */
export function getFacilityById(id) {
  const all = getAllFacilities();
  const found = all.find((f) => f.id === id);
  if (!found) return null;
  const hazmatInfo = resolveHazmatProfile(found);
  return {
    ...found,
    hazmat_profile: hazmatInfo,
    isolation_distance_meters: hazmatInfo?.initial_isolation_distance_meters || 800,
    downwind_evacuation_day_meters: hazmatInfo?.downwind_evacuation_day_meters || 1600,
    downwind_evacuation_night_meters: hazmatInfo?.downwind_evacuation_night_meters || 2400,
    un_na_numbers: hazmatInfo?.un_na_numbers || [],
    primary_chemicals: hazmatInfo?.primary_chemicals || [],
    toxic_combustion_byproducts: hazmatInfo?.toxic_combustion_byproducts || [],
    firefighting_protocol: hazmatInfo?.firefighting_protocol || '',
  };
}



