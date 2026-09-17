/**
 * @module disasters/landslide/engines/terrainEngine
 * @description Computes Native Terrain Vulnerability and Empirical Trigger Resistance (TR).
 * Uses dimensionless, normalized metrics to ensure unit consistency and avoid arbitrary constants.
 */

import { getRegionalProfile } from '../data/terrainProfiles.js';

/**
 * Calculate the compound terrain vulnerability score based on slope, flow convergence, and curvature.
 *
 * Key principle:
 * High TWI alone (e.g. in a flat valley) does NOT indicate landslide hazard.
 * The critical hazard occurs where steep slope and flow convergence coincide (concave amphitheaters/hollows).
 *
 * @param {Object} params
 * @param {number} params.slopeDegrees - Native 30m slope angle (0 to 90 deg)
 * @param {number} [params.twiNormalized=0.5] - Normalized Topographic Wetness Index (0 to 1)
 * @param {number} [params.profileCurvature=0.0] - Profile curvature (negative = concave flow acceleration)
 * @returns {number} Normalized terrain vulnerability V_terrain in [0, 1]
 */
export function computeTerrainVulnerability({
  slopeDegrees,
  twiNormalized = 0.5,
  profileCurvature = 0.0,
}) {
  const theta = Math.max(0.0, Math.min(80.0, Number(slopeDegrees) || 0.0));
  const betaRad = (theta * Math.PI) / 180.0;
  const sinBeta = Math.sin(betaRad); // 0 at 0 deg, 0.5 at 30 deg, 0.707 at 45 deg

  const twiNorm = Math.max(0.0, Math.min(1.0, Number(twiNormalized) || 0.5));
  const profCurv = Number(profileCurvature) || 0.0;

  // 1. Direct slope steepness factor (normalized: steep slopes > 35° approach 1.0)
  const slopeFactor = Math.min(1.0, sinBeta / Math.sin((42.0 * Math.PI) / 180.0));

  // 2. Non-linear compound interaction: convergence is only dangerous on sloping ground
  const convergenceInteraction = sinBeta * twiNorm;

  // 3. Concave hollow acceleration factor (negative curvature accelerates water into the hollow)
  const curvatureFactor = profCurv < 0 ? Math.min(1.0, Math.abs(profCurv) / 0.08) : 0.0;

  // Weighted linear combination of normalized geometric factors
  const vTerrain = 0.50 * slopeFactor + 0.35 * convergenceInteraction + 0.15 * curvatureFactor;
  return Math.max(0.0, Math.min(1.0, Math.round(vTerrain * 1000) / 1000));
}

/**
 * Compute the composite Empirical Trigger Resistance (TR) for a slope.
 *
 * Formulation:
 * V_composite = w_terrain * V_terrain + w_soil * V_soil + w_history * V_history
 * TR = clamp(1.0 - V_composite, 0.05, 1.0)
 *
 * A highly vulnerable, steep, historically failing slope has low TR (e.g. 0.15 - 0.25).
 * A gentle, well-drained, stable slope has high TR (e.g. 0.85 - 0.95).
 *
 * @param {Object} params
 * @param {Object} params.terrain - { slopeDegrees, twiNormalized, profileCurvature }
 * @param {number} [params.soilVulnerability=0.5] - Soil texture/weathering vulnerability in [0, 1]
 * @param {number} [params.historicalFailureDensity=0.5] - Historical landslide scar density in [0, 1]
 * @param {string} [params.regionalProfileId='WESTERN_GHATS_LATERITIC']
 * @returns {{ vTerrain: number, vComposite: number, triggerResistance: number }}
 */
export function computeTriggerResistance({
  terrain = {},
  soilVulnerability = 0.5,
  historicalFailureDensity = 0.5,
  regionalProfileId = 'WESTERN_GHATS_LATERITIC',
}) {
  const profile = getRegionalProfile(regionalProfileId);
  const weights = profile.vulnerabilityWeights;

  const vTerrain = computeTerrainVulnerability(terrain);
  const vSoil = Math.max(0.0, Math.min(1.0, Number(soilVulnerability) || 0.5));
  const vHistory = Math.max(0.0, Math.min(1.0, Number(historicalFailureDensity) || 0.0));

  const vComposite =
    weights.terrain * vTerrain +
    weights.soil * vSoil +
    weights.history * vHistory;

  const tr = Math.max(0.05, Math.min(1.0, 1.0 - vComposite));

  return {
    vTerrain: Math.round(vTerrain * 1000) / 1000,
    vComposite: Math.round(vComposite * 1000) / 1000,
    triggerResistance: Math.round(tr * 1000) / 1000,
  };
}
