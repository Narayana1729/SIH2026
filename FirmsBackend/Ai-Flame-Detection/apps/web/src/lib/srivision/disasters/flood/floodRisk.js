/**
 * @module disasters/flood/floodRisk
 * @description Rainfall-Driven Flood Susceptibility Indicator.
 * Computes a heuristic index combining heavy precipitation anomaly with topographic slope.
 *
 * Explicitly labeled as a HEURISTIC ENVIRONMENTAL INDICATOR (not a full hydrological flood simulation).
 */

import { createDataProvenance, SOURCE_TYPES } from '../../core/provenance.js';

export function computeFloodSusceptibility({
  precipitationMm = 0,
  precipitationAnomalyPct = 0,
  slopeDegrees = 2.0,
  elevationM = 50,
} = {}) {
  const rain = Number(precipitationMm) || 0;
  const anomaly = Number(precipitationAnomalyPct) || 0;
  const slope = Number(slopeDegrees) || 2.0;

  // Heuristic index scoring
  let score = 0.10;
  const factors = [];

  // 1. Extreme rainfall intensity
  if (rain >= 100) {
    score += 0.45;
    factors.push({ factor: 'Extreme Daily Precipitation', impact: 'CRITICAL', value: `${rain.toFixed(1)} mm` });
  } else if (rain >= 50) {
    score += 0.30;
    factors.push({ factor: 'Heavy Precipitation Event', impact: 'HIGH', value: `${rain.toFixed(1)} mm` });
  } else if (rain >= 25) {
    score += 0.15;
    factors.push({ factor: 'Moderate Rainfall', impact: 'MODERATE', value: `${rain.toFixed(1)} mm` });
  }

  // 2. Low-lying terrain accumulation (low slope collects runoff)
  if (slope <= 1.5 && elevationM < 100) {
    score += 0.25;
    factors.push({ factor: 'Low-Lying Flat Topography', impact: 'HIGH', value: `${slope.toFixed(1)}° slope, ${elevationM}m alt` });
  } else if (slope <= 3.0) {
    score += 0.10;
    factors.push({ factor: 'Low Gradient Catchment', impact: 'MODERATE', value: `${slope.toFixed(1)}° slope` });
  }

  // 3. Precipitation anomaly over historical mean
  if (anomaly >= 50) {
    score += 0.15;
    factors.push({ factor: 'Significant Precipitation Surplus', impact: 'MODERATE', value: `+${anomaly}% anomaly` });
  }

  const susceptibilityScore = Math.max(0.05, Math.min(0.98, Math.round(score * 100) / 100));

  let severity = 'LOW';
  if (susceptibilityScore >= 0.70) severity = 'CRITICAL';
  else if (susceptibilityScore >= 0.45) severity = 'HIGH';
  else if (susceptibilityScore >= 0.25) severity = 'MODERATE';

  return {
    indicator_type: 'RAINFALL_DRIVEN_FLOOD_SUSCEPTIBILITY_INDICATOR',
    susceptibility_score: susceptibilityScore,
    severity,
    contributing_factors: factors,
    operator_action: severity === 'CRITICAL' || severity === 'HIGH'
      ? 'Elevated flood susceptibility: Inspect low-elevation drainage channels and monitor precipitation radar.'
      : 'Routine hydrological monitoring.',
    provenance: createDataProvenance({
      source: 'sriVision Environmental Indicator Engine',
      sourceType: SOURCE_TYPES.RULE_BASED,
      processing: ['precipitation_slope_heuristic_aggregation'],
      confidenceType: 'DETERMINISTIC_HEURISTIC_BASELINE',
      limitations: [
        'Model is a rainfall-driven susceptibility indicator, not a calibrated hydrological hydrodynamic flow simulation.',
        'Local storm drain capacities, soil infiltration rates, and river gauge telemetry are not modeled.',
      ],
    }),
  };
}
