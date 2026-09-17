/**
 * @module src/disasters/wildfire/fireSpreadSimulation
 * @description Physics-informed wildfire Rate-of-Spread (ROS) and elliptical perimeter simulation.
 */

import { createDataProvenance } from '../../core/provenance.js';

// Standard Fuel Model Base Spread Rates (m/min in zero wind/slope)
const FUEL_MODELS = {
  GRASSLAND: { baseRosMPerMin: 1.8, moistureExtinction: 0.15, description: 'Short/dry grass, rapid flashy spread' },
  SHRUBLAND: { baseRosMPerMin: 1.2, moistureExtinction: 0.20, description: 'Chaparral/brush, high flame lengths' },
  DENSE_FOREST: { baseRosMPerMin: 0.5, moistureExtinction: 0.30, description: 'Dense canopy & heavy timber litter' },
  AGRICULTURAL_STUBBLE: { baseRosMPerMin: 2.2, moistureExtinction: 0.12, description: 'Paddy/wheat crop residue burning' },
  DEFAULT: { baseRosMPerMin: 0.8, moistureExtinction: 0.25, description: 'Mixed vegetation baseline' },
};

/**
 * Compute slope coefficient multiplier (Rothermel slope factor: Phi_s = 5.275 * tan(slope)^2).
 */
export function computeSlopeFactor(slopeDegrees) {
  const rad = (Math.max(0, Math.min(60, slopeDegrees)) * Math.PI) / 180;
  const tanSlope = Math.tan(rad);
  return 5.275 * Math.pow(tanSlope, 2);
}

/**
 * Compute wind coefficient multiplier (Phi_w = C * U^B).
 *
 * SCIENTIFIC CITATIONS:
 * - Rothermel, R. C. (1972). "A mathematical model for predicting fire spread in wildland fuels".
 *   USDA Forest Service Research Paper INT-115, pp. 26-32.
 * - Albini, F. A. (1976). "Estimating wildfire behavior and effects". USDA Forest Service GTR INT-30.
 *
 * In the complete Rothermel formulation, Phi_w = C * U^B * (beta / beta_op)^(-E).
 * For real-time operational simulation with midflame wind speed U (m/s), standard wildland fuel
 * parameterizations approximate this with empirical scaling constants C = 0.9 and B = 1.4.
 */
export function computeWindFactor(windSpeedKmh) {
  const uMps = Math.max(0, windSpeedKmh / 3.6);
  // Operational power-law wind coefficient (Rothermel 1972 / Albini 1976)
  return 0.9 * Math.pow(uMps, 1.4);
}

/**
 * Simulate forward rate of spread (ROS) in meters per minute.
 */
export function calculateRateOfSpread({
  fuelCategory = 'DEFAULT',
  windSpeedKmh = 15,
  slopeDegrees = 0,
  relativeHumidity = 30,
}) {
  const fuel = FUEL_MODELS[fuelCategory.toUpperCase()] || FUEL_MODELS.DEFAULT;
  const baseRos = fuel.baseRosMPerMin;

  const phiW = computeWindFactor(windSpeedKmh);
  const phiS = computeSlopeFactor(slopeDegrees);

  // Moisture damping factor (humidity above 50% slows spread, below 20% accelerates)
  const moistureFactor = Math.max(0.3, Math.min(1.8, 1.0 + (30 - relativeHumidity) * 0.02));

  const headRosMPerMin = baseRos * (1 + phiW + phiS) * moistureFactor;
  // Flank ROS and Backing ROS ratios based on length-to-width ratio (L/W)
  const lwRatio = Math.max(1.0, 1.0 + 0.125 * (windSpeedKmh / 3.6));
  const flankRosMPerMin = headRosMPerMin / lwRatio;
  const backRosMPerMin = headRosMPerMin / (2 * lwRatio);

  return {
    head_ros_m_per_min: Math.round(headRosMPerMin * 100) / 100,
    flank_ros_m_per_min: Math.round(flankRosMPerMin * 100) / 100,
    back_ros_m_per_min: Math.round(backRosMPerMin * 100) / 100,
    length_to_width_ratio: Math.round(lwRatio * 100) / 100,
  };
}

/**
 * Generate simulated perimeter contours for progressive time horizons (e.g. 1h, 2h, 4h).
 */
export function simulateFirePerimeters({
  lat,
  lon,
  windSpeedKmh = 20,
  windDirectionDeg = 270, // Wind blowing FROM 270 (West), fire spreads East (90 deg)
  slopeDegrees = 5,
  fuelCategory = 'DENSE_FOREST',
  relativeHumidity = 25,
  timeHorizonsHours = [1, 2, 4],
}) {
  const ros = calculateRateOfSpread({ fuelCategory, windSpeedKmh, slopeDegrees, relativeHumidity });
  const spreadHeadingDeg = (windDirectionDeg + 180) % 360;
  const spreadHeadingRad = (spreadHeadingDeg * Math.PI) / 180;

  const latMetersPerDeg = 111132.954;
  const lonMetersPerDeg = 111132.954 * Math.cos((lat * Math.PI) / 180);

  const perimeters = timeHorizonsHours.map((hours) => {
    const minutes = hours * 60;
    const a = ros.head_ros_m_per_min * minutes; // semi-major forward expansion
    const b = ros.flank_ros_m_per_min * minutes; // semi-minor crosswind expansion
    const backDist = ros.back_ros_m_per_min * minutes;

    // Center of ellipse shifted downwind from ignition origin
    const centerShiftMeters = (a - backDist) / 2;
    const semiMajorA = (a + backDist) / 2;

    const ringCoords = [];
    const numPoints = 36;

    for (let i = 0; i <= numPoints; i++) {
      const theta = (i * 2 * Math.PI) / numPoints;
      // Ellipse point in local coordinates (aligned with spread heading)
      const xLocal = semiMajorA * Math.cos(theta) + centerShiftMeters;
      const yLocal = b * Math.sin(theta);

      // Rotate to spread heading
      const dx = xLocal * Math.sin(spreadHeadingRad) + yLocal * Math.cos(spreadHeadingRad);
      const dy = xLocal * Math.cos(spreadHeadingRad) - yLocal * Math.sin(spreadHeadingRad);

      const pLat = lat + dy / latMetersPerDeg;
      const pLon = lon + dx / lonMetersPerDeg;

      ringCoords.push([Math.round(pLon * 1e6) / 1e6, Math.round(pLat * 1e6) / 1e6]);
    }

    const burnedAreaHectares = Math.round(((Math.PI * semiMajorA * b) / 10000) * 10) / 10;

    return {
      time_horizon_hours: hours,
      burned_area_hectares: burnedAreaHectares,
      forward_spread_km: Math.round((a / 1000) * 100) / 100,
      polygon_geojson: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [ringCoords],
        },
        properties: {
          horizon_hours: hours,
          burned_hectares: burnedAreaHectares,
        },
      },
    };
  });

  return {
    ignition_point: { lat, lon },
    fuel_category: fuelCategory,
    spread_heading_deg: Math.round(spreadHeadingDeg * 10) / 10,
    rate_of_spread: ros,
    perimeters,
    provenance: createDataProvenance({
      source: 'sriVision Rate-of-Spread Elliptical Physics Engine',
      sourceType: 'PHYSICS_SIMULATION',
      confidenceBasis: 'ROTHERMEL_SURFACE_FIRE_MODEL',
      limitations: [
        'Assumes homogeneous fuel bed and static meteorological conditions over time horizons.',
        'Crown fire transitions and ember spotting distances are not dynamically simulated.',
      ],
    }),
  };
}
