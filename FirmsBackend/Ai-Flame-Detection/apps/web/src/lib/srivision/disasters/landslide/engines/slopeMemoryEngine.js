/**
 * @module disasters/landslide/engines/slopeMemoryEngine
 * @description Multi-Timescale Slope Memory & Drainage Hysteresis Engine.
 * Models fast, medium, and slow hydrological memory reservoirs using calibrated half-life decay constants.
 */

import { getRegionalProfile } from '../data/terrainProfiles.js';

/**
 * Calculate the exponential decay coefficient lambda from half-life in hours.
 * Formula: lambda = ln(2) / T_half
 * @param {number} halfLifeHours
 * @returns {number} lambda (1/hour)
 */
export function computeDecayRate(halfLifeHours) {
  const tHalf = Math.max(0.1, Number(halfLifeHours) || 6.0);
  return Math.LN2 / tHalf;
}

/**
 * Advance a multi-timescale memory state forward by deltaHours given new rainfall influx P(t).
 *
 * @param {Object} currentMemory - { fastMm, mediumMm, slowMm }
 * @param {number} rainfallMm - Rainfall accumulation during the timestep deltaHours
 * @param {number} [deltaHours=1.0] - Time interval in hours
 * @param {string} [regionalProfileId='WESTERN_GHATS_LATERITIC']
 * @returns {{ fastMm: number, mediumMm: number, slowMm: number }}
 */
export function advanceSlopeMemory(
  currentMemory = { fastMm: 0, mediumMm: 0, slowMm: 0 },
  rainfallMm = 0,
  deltaHours = 1.0,
  regionalProfileId = 'WESTERN_GHATS_LATERITIC'
) {
  const profile = getRegionalProfile(regionalProfileId);
  const { fastHalfLifeHours, mediumHalfLifeHours, slowHalfLifeHours } = profile.memory;

  const lambdaFast = computeDecayRate(fastHalfLifeHours);
  const lambdaMed = computeDecayRate(mediumHalfLifeHours);
  const lambdaSlow = computeDecayRate(slowHalfLifeHours);

  const dt = Math.max(0.01, Number(deltaHours) || 1.0);
  const p = Math.max(0.0, Number(rainfallMm) || 0.0);

  const prevFast = Math.max(0.0, Number(currentMemory.fastMm) || 0.0);
  const prevMed = Math.max(0.0, Number(currentMemory.mediumMm) || 0.0);
  const prevSlow = Math.max(0.0, Number(currentMemory.slowMm) || 0.0);

  // Exponential decay + new rainfall influx
  const newFast = prevFast * Math.exp(-lambdaFast * dt) + p;
  const newMed = prevMed * Math.exp(-lambdaMed * dt) + p;
  const newSlow = prevSlow * Math.exp(-lambdaSlow * dt) + p;

  return {
    fastMm: Math.round(newFast * 100) / 100,
    mediumMm: Math.round(newMed * 100) / 100,
    slowMm: Math.round(newSlow * 100) / 100,
  };
}

/**
 * Compute the composite dimensionless memory index H_memory in [0, 1+].
 *
 * Formulation:
 * H_memory = w_f * (fast / fast_crit) + w_m * (medium / med_crit) + w_s * (slow / slow_crit)
 *
 * @param {Object} memory - { fastMm, mediumMm, slowMm }
 * @param {string} [regionalProfileId='WESTERN_GHATS_LATERITIC']
 * @returns {{ hMemory: number, normalizedFast: number, normalizedMed: number, normalizedSlow: number }}
 */
export function computeCompositeMemoryIndex(
  memory = { fastMm: 0, mediumMm: 0, slowMm: 0 },
  regionalProfileId = 'WESTERN_GHATS_LATERITIC'
) {
  const profile = getRegionalProfile(regionalProfileId);
  const { fastMemoryCritMm, mediumMemoryCritMm, slowMemoryCritMm } = profile.criticalThresholds;
  const { fast: wf, medium: wm, slow: ws } = profile.memoryWeights;

  const normFast = Math.max(0.0, (Number(memory.fastMm) || 0.0) / fastMemoryCritMm);
  const normMed = Math.max(0.0, (Number(memory.mediumMm) || 0.0) / mediumMemoryCritMm);
  const normSlow = Math.max(0.0, (Number(memory.slowMm) || 0.0) / slowMemoryCritMm);

  const hMem = wf * normFast + wm * normMed + ws * normSlow;

  return {
    hMemory: Math.round(hMem * 1000) / 1000,
    normalizedFast: Math.round(normFast * 1000) / 1000,
    normalizedMed: Math.round(normMed * 1000) / 1000,
    normalizedSlow: Math.round(normSlow * 1000) / 1000,
  };
}
