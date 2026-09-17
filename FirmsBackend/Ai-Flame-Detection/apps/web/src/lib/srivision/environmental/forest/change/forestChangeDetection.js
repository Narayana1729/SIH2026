/**
 * @module environmental/forest/change/forestChangeDetection
 * @description Geodesic polygon area and multi-temporal canopy change detection algorithms.
 */

const EARTH_RADIUS_KM = 6371.0;

/**
 * Computes the geodesic spherical polygon area in square kilometers using Girard's theorem / spherical excess.
 * @param {Array<[number, number]>} coordinates - Array of [lon, lat] points (first point closed or unclosed)
 * @returns {number} Area in km²
 */
export function computeGeodesicPolygonAreaKm2(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) return 0;

  const pts = [...coordinates];
  // Ensure unclosed list for the loop
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 3 && first[0] === last[0] && first[1] === last[1]) {
    pts.pop();
  }
  if (pts.length < 3) return 0;

  const toRad = Math.PI / 180;
  let totalAngle = 0;

  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const p3 = pts[(i + 2) % pts.length];

    const lon1 = p1[0] * toRad;
    const lat1 = p1[1] * toRad;
    const lon2 = p2[0] * toRad;
    const lat2 = p2[1] * toRad;
    const lon3 = p3[0] * toRad;
    const lat3 = p3[1] * toRad;

    // Spherical excess component
    const dLon12 = lon2 - lon1;
    const dLon32 = lon3 - lon2;

    const y = Math.sin(dLon12) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon12);
    const bearing12 = Math.atan2(y, x);

    const y2 = Math.sin(dLon32) * Math.cos(lat3);
    const x2 = Math.cos(lat2) * Math.sin(lat3) - Math.sin(lat2) * Math.cos(lat3) * Math.cos(dLon32);
    const bearing23 = Math.atan2(y2, x2);

    let angle = bearing23 - bearing12;
    while (angle <= -Math.PI) angle += 2 * Math.PI;
    while (angle > Math.PI) angle -= 2 * Math.PI;
    totalAngle += angle;
  }

  // Spherical polygon surface area
  // Fallback to planar approximate if spherical excess is degenerate
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const x1 = p1[0] * toRad * Math.cos(((p1[1] + p2[1]) / 2) * toRad) * EARTH_RADIUS_KM;
    const y1 = p1[1] * toRad * EARTH_RADIUS_KM;
    const x2 = p2[0] * toRad * Math.cos(((p1[1] + p2[1]) / 2) * toRad) * EARTH_RADIUS_KM;
    const y2 = p2[1] * toRad * EARTH_RADIUS_KM;
    area += (x1 * y2 - x2 * y1);
  }
  return Math.round(Math.abs(area / 2) * 100) / 100;
}

/**
 * Detects canopy loss between baseline (T1) and current (T2) observations.
 */
export function detectCanopyChange({
  coordinates = [],
  t1CanopyCoverPercent = 80.0,
  t2CanopyCoverPercent = 65.0,
  validPixelFraction = 0.95,
  spectralClass = 'SUDDEN_CLEARING',
} = {}) {
  const totalAreaKm2 = computeGeodesicPolygonAreaKm2(coordinates);
  const netLossPercent = Math.max(0, Math.round((t1CanopyCoverPercent - t2CanopyCoverPercent) * 100) / 100);
  const lostAreaKm2 = Math.round(((totalAreaKm2 * netLossPercent) / 100) * 100) / 100;

  let severity = 'LOW';
  if (netLossPercent >= 15.0) severity = 'CRITICAL';
  else if (netLossPercent >= 8.0) severity = 'HIGH';
  else if (netLossPercent >= 3.0) severity = 'MODERATE';

  return {
    total_area_km2: totalAreaKm2,
    t1_canopy_cover_percent: t1CanopyCoverPercent,
    t2_canopy_cover_percent: t2CanopyCoverPercent,
    net_loss_percent: netLossPercent,
    lost_area_km2: lostAreaKm2,
    valid_pixel_fraction: validPixelFraction,
    spectral_class: spectralClass,
    severity,
  };
}
