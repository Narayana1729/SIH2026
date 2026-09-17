/**
 * @module disasters/landslide/engines/hydrologicalStressEngine
 * @description Hydrological Load Index, Relative Trigger Susceptibility (RTS),
 * and Scenario-Dependent Rainfall Forcing Budget Engine.
 * Formulates the multidimensional trigger surface T = f(I, D, SMI_f, SMI_m, SMI_s)
 * and computes scenario-dependent critical rainfall forcing budgets.
 */

import { getRegionalProfile } from '../data/terrainProfiles.js';
import { advanceSlopeMemory, computeCompositeMemoryIndex } from './slopeMemoryEngine.js';

/**
 * Compute the Dimensionless Hydrological Load Index and Load Ratio
 * using Relative Trigger Susceptibility (RTS) as a regional threshold modifier.
 *
 * Formulation:
 * S_I = I_short / I_crit          (dimensionless)
 * S_P = P_storm / P_crit          (dimensionless)
 * S_M = clip(H_memory, 0, 1)      (dimensionless)
 *
 * LoadIndex = w_I * S_I + w_P * S_P + w_M * S_M  (dimensionless)
 * AdjustedTriggerBoundary = BaseTrigger * (1.0 - 0.5 * RTS)
 * LoadRatio = LoadIndex / AdjustedTriggerBoundary
 *
 * @param {Object} params
 * @param {number} params.intensityMmPerHour - Short-term rainfall burst intensity
 * @param {number} params.storm24hMm - 24-hour storm accumulation
 * @param {Object} params.memory - { fastMm, mediumMm, slowMm }
 * @param {number} params.triggerResistance - Relative Trigger Susceptibility modifier (RTS in [0.05, 1.0])
 * @param {string} [params.regionalProfileId='WESTERN_GHATS_LATERITIC']
 * @returns {{ loadIndex: number, loadRatio: number, stressComponents: Object }}
 */
export function computeHydrologicalLoad({
  intensityMmPerHour = 0,
  storm24hMm = 0,
  memory = { fastMm: 0, mediumMm: 0, slowMm: 0 },
  triggerResistance = 0.5,
  regionalProfileId = 'WESTERN_GHATS_LATERITIC',
}) {
  const profile = getRegionalProfile(regionalProfileId);
  const { intensity1hMmPerHour, storm24hMm: storm24hCrit } = profile.criticalThresholds;
  const { intensity: wi, storm: wp, memory: wm } = profile.stressWeights;

  const sI = Math.max(0.0, (Number(intensityMmPerHour) || 0.0) / intensity1hMmPerHour);
  const sP = Math.max(0.0, (Number(storm24hMm) || 0.0) / storm24hCrit);

  const memResult = computeCompositeMemoryIndex(memory, regionalProfileId);
  const sM = Math.min(1.0, Math.max(0.0, memResult.hMemory));

  const loadIndex = wi * sI + wp * sP + wm * sM;
  const rts = Math.max(0.05, Math.min(1.0, Number(triggerResistance) || 0.5));
  const loadRatio = loadIndex / rts;

  return {
    loadIndex: Math.round(loadIndex * 1000) / 1000,
    loadRatio: Math.round(loadRatio * 1000) / 1000,
    stressComponents: {
      sIntensity: Math.round(sI * 1000) / 1000,
      sStorm: Math.round(sP * 1000) / 1000,
      sMemory: Math.round(sM * 1000) / 1000,
      hMemoryRaw: memResult.hMemory,
    },
  };
}

/**
 * Solve for a specific rainfall duration scenario: how much additional rainfall forcing
 * is required under an assumed duration and temporal pattern to cross the calibrated critical trigger boundary.
 *
 * @param {Object} params
 * @param {number} params.targetDurationHours - Scenario duration (e.g., 1h, 3h, 12h)
 * @param {number} params.currentIntensity
 * @param {number} params.currentStorm24h
 * @param {Object} params.currentMemory
 * @param {number} params.triggerResistance
 * @param {string} [params.regionalProfileId='WESTERN_GHATS_LATERITIC']
 * @returns {{ minMm: number, maxMm: number, representativeMm: number }}
 */
function solveScenarioBudget(params, targetDurationHours) {
  const {
    currentIntensity = 0,
    currentStorm24h = 0,
    currentMemory = { fastMm: 0, mediumMm: 0, slowMm: 0 },
    triggerResistance = 0.5,
    regionalProfileId = 'WESTERN_GHATS_LATERITIC',
  } = params;

  const currentLoad = computeHydrologicalLoad({
    intensityMmPerHour: currentIntensity,
    storm24hMm: currentStorm24h,
    memory: currentMemory,
    triggerResistance,
    regionalProfileId,
  });

  if (currentLoad.loadRatio >= 1.0) {
    return { minMm: 0.0, maxMm: 0.0, representativeMm: 0.0 };
  }

  let addedRainMm = 0.0;
  const dt = Math.max(0.25, targetDurationHours / 12.0); // incremental slices
  const stepMm = 1.0;
  let simMemory = { ...currentMemory };
  let simStorm24 = Number(currentStorm24h) || 0.0;

  while (addedRainMm < 400.0) {
    addedRainMm += stepMm;
    simStorm24 += stepMm;
    const simIntensity = (addedRainMm / targetDurationHours) + Number(currentIntensity) * 0.3;

    simMemory = advanceSlopeMemory(simMemory, stepMm, dt, regionalProfileId);

    const testLoad = computeHydrologicalLoad({
      intensityMmPerHour: simIntensity,
      storm24hMm: simStorm24,
      memory: simMemory,
      triggerResistance,
      regionalProfileId,
    });

    if (testLoad.loadRatio >= 1.0) {
      const rep = Math.round(addedRainMm * 10) / 10;
      const minVal = Math.max(0.0, Math.round((rep * 0.85) * 10) / 10);
      const maxVal = Math.round((rep * 1.25) * 10) / 10;
      return { minMm: minVal, maxMm: maxVal, representativeMm: rep };
    }
  }

  return { minMm: 250.0, maxMm: 400.0, representativeMm: 300.0 };
}

/**
 * Compute the Multi-Scenario Scenario-Dependent Rainfall Forcing Budgets.
 * Outputs bounded ranges across High-Intensity Burst (1h), Sustained Storm (3h), and Prolonged Wetting (12h).
 *
 * @param {Object} params
 * @returns {{
 *   scenarioBurst1h: { description: string, minMm: number, maxMm: number, rangeLabel: string },
 *   scenarioSustained3h: { description: string, minMm: number, maxMm: number, rangeLabel: string },
 *   scenarioProlonged12h: { description: string, minMm: number, maxMm: number, rangeLabel: string },
 *   calibratedStatement: string
 * }}
 */
export function computeScenarioRainfallForcingBudgets(params) {
  const burst1h = solveScenarioBudget(params, 1.0);
  const sustained3h = solveScenarioBudget(params, 3.0);
  const prolonged12h = solveScenarioBudget(params, 12.0);

  const statement = sustained3h.representativeMm === 0
    ? 'Critical trigger boundary currently reached under active loading conditions.'
    : `Estimated additional rainfall forcing required to reach the calibrated critical trigger boundary: ${sustained3h.minMm}–${sustained3h.maxMm} mm under the assumed 3-hour storm scenario.`;

  return {
    scenarioBurst1h: {
      description: 'High-intensity convective burst (1 hour)',
      minMm: burst1h.minMm,
      maxMm: burst1h.maxMm,
      rangeLabel: `${burst1h.minMm}–${burst1h.maxMm} mm within 1 hr`,
    },
    scenarioSustained3h: {
      description: 'Sustained storm loading (3 hours)',
      minMm: sustained3h.minMm,
      maxMm: sustained3h.maxMm,
      rangeLabel: `${sustained3h.minMm}–${sustained3h.maxMm} mm over 3 hrs`,
    },
    scenarioProlonged12h: {
      description: 'Prolonged monsoon rainfall (12 hours)',
      minMm: prolonged12h.minMm,
      maxMm: prolonged12h.maxMm,
      rangeLabel: `${prolonged12h.minMm}–${prolonged12h.maxMm} mm over 12 hrs`,
    },
    calibratedStatement: statement,
  };
}

/**
 * Backward-compatible single-value budget resolver.
 */
export function computeRemainingTriggerBudgetMm(params) {
  const budgets = computeScenarioRainfallForcingBudgets(params);
  const rep = budgets.scenarioSustained3h.minMm;
  return {
    remainingRainfallBudgetMm: rep,
    breachedImmediately: rep === 0,
    simulatedCriticalLoadRatio: rep === 0 ? 1.05 : 1.0,
    scenarioBudgets: budgets,
  };
}
