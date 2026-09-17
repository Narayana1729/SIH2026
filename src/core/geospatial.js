/**
 * @module core/geospatial
 * @description Core GIS calculations, coordinate math, geoid conversions, and horizon culling.
 */

export const EARTH_RADIUS_KM = 6371.0;

/**
 * Great-circle distance between two WGS84 points in kilometers (Haversine formula).
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180))
    * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a))) * 100) / 100;
}

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  return haversineKm(lat1, lon1, lat2, lon2);
}

/**
 * Computes EGM96 geoid height offset for converting MSL to ellipsoidal height.
 */
export function getGeoidHeight(lat, lon) {
  try {
    return egm96(lat, lon) || 0;
  } catch {
    return 0;
  }
}

/**
 * Simple horizon culling check: is point (lat, lon, alt) visible from camera (cLat, cLon, cAlt).
 */
export function isPointAboveHorizon(lat, lon, altM, cameraLat, cameraLon, cameraAltM) {
  const distKm = haversineKm(lat, lon, cameraLat, cameraLon);
  const dCameraKm = Math.sqrt(2 * EARTH_RADIUS_KM * (Math.max(10, cameraAltM) / 1000));
  const dTargetKm = Math.sqrt(2 * EARTH_RADIUS_KM * (Math.max(0, altM) / 1000));
  return distKm <= (dCameraKm + dTargetKm);
}
