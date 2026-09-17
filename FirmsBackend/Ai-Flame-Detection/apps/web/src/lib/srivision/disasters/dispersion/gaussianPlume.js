/**
 * @module src/disasters/dispersion/gaussianPlume
 * @description Physics-based atmospheric Gaussian Plume toxic dispersion model (Pasquill-Gifford).
 */

import { createDataProvenance } from '../../core/provenance.js';

// Pasquill-Gifford dispersion parameter coefficients: sigma_y = a * (x/1000)^b, sigma_z = c * (x/1000)^d
// x in meters (converted to km for standard power-law coefficients)
const PASQUILL_GIFFORD_COEFFS = {
  A: { a: 213, b: 0.894, c: 440.8, d: 1.941 }, // Extremely Unstable
  B: { a: 156, b: 0.894, c: 106.6, d: 1.149 }, // Moderately Unstable
  C: { a: 104, b: 0.894, c: 61.0, d: 0.911 },  // Slightly Unstable
  D: { a: 68, b: 0.894, c: 33.2, d: 0.725 },   // Neutral (Overcast / High Wind)
  E: { a: 50.5, b: 0.894, c: 22.8, d: 0.678 }, // Slightly Stable (Nighttime)
  F: { a: 34, b: 0.894, c: 14.35, d: 0.740 },  // Moderately Stable (Clear Night)
};

/**
 * Determine Pasquill stability class from wind speed and day/night state.
 * @param {number} windSpeedMps 
 * @param {boolean} isDaytime 
 * @param {string} [solarRadiation='moderate'] 'strong' | 'moderate' | 'slight' | 'overcast'
 * @returns {string} 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
 */
export function estimateStabilityClass(windSpeedMps, isDaytime = true, solarRadiation = 'moderate') {
  const u = Math.max(0.5, windSpeedMps);
  if (isDaytime) {
    if (u < 2) return solarRadiation === 'strong' ? 'A' : 'B';
    if (u < 3) return solarRadiation === 'strong' ? 'A' : 'B';
    if (u < 5) return solarRadiation === 'strong' ? 'B' : 'C';
    if (u < 6) return 'C';
    return 'D';
  } else {
    // Nighttime
    if (u < 2) return 'F';
    if (u < 3) return 'E';
    if (u < 5) return 'D';
    return 'D';
  }
}

/**
 * Compute dispersion standard deviations (sigma_y, sigma_z) at downwind distance x (meters).
 */
export function computeSigmas(downwindXMeters, stabilityClass = 'D') {
  const coeff = PASQUILL_GIFFORD_COEFFS[stabilityClass] || PASQUILL_GIFFORD_COEFFS.D;
  const xKm = Math.max(0.01, downwindXMeters / 1000);
  const sigmaY = coeff.a * Math.pow(xKm, coeff.b);
  const sigmaZ = Math.max(1, coeff.c * Math.pow(xKm, coeff.d));
  return { sigmaY, sigmaZ };
}

/**
 * Calculate ground-level concentration C(x, y, 0) in mg/m3.
 * @param {Object} params
 * @param {number} params.emissionRateGps - Q (grams per second)
 * @param {number} params.windSpeedMps - u (meters per second)
 * @param {number} params.effectiveHeightMeters - H (meters, e.g. stack or plume rise)
 * @param {number} params.downwindXMeters - x along plume centerline
 * @param {number} params.crosswindYMeters - y perpendicular to centerline
 * @param {string} [params.stabilityClass='D']
 * @returns {number} Concentration in mg/m3
 */
export function calculateGroundConcentration({
  emissionRateGps,
  windSpeedMps,
  effectiveHeightMeters = 10,
  downwindXMeters,
  crosswindYMeters = 0,
  stabilityClass = 'D',
}) {
  if (downwindXMeters <= 0) return 0;
  const u = Math.max(0.5, windSpeedMps);
  const Q = Math.max(0.1, emissionRateGps);
  const H = Math.max(0, effectiveHeightMeters);

  const { sigmaY, sigmaZ } = computeSigmas(downwindXMeters, stabilityClass);

  const exponentY = -Math.pow(crosswindYMeters, 2) / (2 * Math.pow(sigmaY, 2));
  const exponentZ = -Math.pow(H, 2) / (2 * Math.pow(sigmaZ, 2));

  // Gaussian reflection at ground (z=0): term is 2 * exp(-H^2 / (2*sigmaZ^2))
  const concentrationGPerM3 = (Q / (Math.PI * u * sigmaY * sigmaZ)) * Math.exp(exponentY) * Math.exp(exponentZ);

  // Convert g/m3 to mg/m3 (multiply by 1000)
  return Math.max(0, concentrationGPerM3 * 1000);
}

/**
 * Generate geospatial plume polygon coordinates for visualization.
 * @param {Object} options
 * @param {number} options.sourceLat
 * @param {number} options.sourceLon
 * @param {number} options.windDirectionDeg - Meteorological wind direction (where wind blows FROM)
 * @param {number} options.windSpeedMps
 * @param {number} [options.emissionRateGps=500]
 * @param {number} [options.effectiveHeightMeters=15]
 * @param {number} [options.maxDistanceKm=15]
 * @param {string} [options.stabilityClass='D']
 * @returns {Object}
 */
export function generatePlumeFootprint({
  sourceLat,
  sourceLon,
  windDirectionDeg,
  windSpeedMps,
  emissionRateGps = 500,
  effectiveHeightMeters = 15,
  maxDistanceKm = 15,
  stabilityClass = 'D',
}) {
  // Plume travels downwind (180 deg opposite from wind origin)
  const plumeHeadingDeg = (windDirectionDeg + 180) % 360;
  const headingRad = (plumeHeadingDeg * Math.PI) / 180;

  const steps = 30;
  const maxMeters = maxDistanceKm * 1000;
  const stepSize = maxMeters / steps;

  const leftBorder = [];
  const rightBorder = [];
  const centerlineSamples = [];

  // Approx conversion factors at latitude
  const latMetersPerDeg = 111132.954;
  const lonMetersPerDeg = 111132.954 * Math.cos((sourceLat * Math.PI) / 180);

  for (let i = 1; i <= steps; i++) {
    const x = i * stepSize;
    const { sigmaY } = computeSigmas(x, stabilityClass);
    const centerConc = calculateGroundConcentration({
      emissionRateGps,
      windSpeedMps,
      effectiveHeightMeters,
      downwindXMeters: x,
      crosswindYMeters: 0,
      stabilityClass,
    });

    // 2.15 * sigmaY represents ~90% plume width boundary
    const plumeHalfWidthMeters = Math.min(x * 0.8, 2.15 * sigmaY);

    // Vector along plume centerline
    const dxCenter = x * Math.sin(headingRad);
    const dyCenter = x * Math.cos(headingRad);

    // Vector perpendicular to centerline
    const dxPerp = plumeHalfWidthMeters * Math.cos(headingRad);
    const dyPerp = -plumeHalfWidthMeters * Math.sin(headingRad);

    const centerLat = sourceLat + dyCenter / latMetersPerDeg;
    const centerLon = sourceLon + dxCenter / lonMetersPerDeg;

    const leftLat = sourceLat + (dyCenter + dyPerp) / latMetersPerDeg;
    const leftLon = sourceLon + (dxCenter + dxPerp) / lonMetersPerDeg;

    const rightLat = sourceLat + (dyCenter - dyPerp) / latMetersPerDeg;
    const rightLon = sourceLon + (dxCenter - dxPerp) / lonMetersPerDeg;

    leftBorder.push([leftLon, leftLat]);
    rightBorder.unshift([rightLon, rightLat]);

    centerlineSamples.push({
      downwind_distance_km: Math.round((x / 1000) * 100) / 100,
      concentration_mg_m3: Math.round(centerConc * 1000) / 1000,
      latitude: centerLat,
      longitude: centerLon,
    });
  }

  // Polygon boundary closing back to source
  const polygonCoordinates = [[sourceLon, sourceLat], ...leftBorder, ...rightBorder, [sourceLon, sourceLat]];

  return {
    model_type: 'GAUSSIAN_ATMOSPHERIC_PLUME',
    source: { lat: sourceLat, lon: sourceLon },
    plume_heading_deg: Math.round(plumeHeadingDeg * 10) / 10,
    wind_speed_mps: windSpeedMps,
    stability_class: stabilityClass,
    max_downwind_km: maxDistanceKm,
    centerline_samples: centerlineSamples,
    polygon_geojson: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoordinates],
      },
      properties: {
        plume_heading_deg: plumeHeadingDeg,
        stability_class: stabilityClass,
        emission_rate_gps: emissionRateGps,
      },
    },
    provenance: createDataProvenance({
      source: 'sriVision Gaussian Plume Dispersion Engine',
      sourceType: 'PHYSICS_SIMULATION',
      confidenceBasis: 'PASQUILL_GIFFORD_ATMOSPHERIC_DISPERSION',
      limitations: [
        'Assumes steady-state homogeneous wind vectors and flat/moderate terrain.',
        'Complex urban canyon turbulence, microclimate inversions, and chemical photo-oxidation are not modeled.',
      ],
    }),
  };
}
