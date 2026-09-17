/**
 * @module disasters/landslide/engines/failureForecastEngine
 * @description Probabilistic Ensemble Forecast Simulation & Failure Window Engine.
 * Projects slope state evolution across Best-Case, Expected, and Worst-Case rainfall scenarios
 * without collapsing uncertainty into a false single timestamp.
 */

import { advanceSlopeMemory, computeCompositeMemoryIndex } from './slopeMemoryEngine.js';
import { computeHydrologicalLoad } from './hydrologicalStressEngine.js';
import { smoothRisk, computeHazardKinematics } from './hazardKinematicsEngine.js';
import { evaluateSlopeState, SLOPE_STATES } from './slopeStateMachine.js';

/**
 * Simulate the forward propagation of a slope state given a forecast hyetograph.
 *
 * @param {Object} params
 * @param {Object} params.initialState - { memory, storm24hMm, triggerResistance, smoothedRisk, state }
 * @param {Array<{ hourOffset: number, expectedRainMm: number }>} params.forecastHyetograph
 * @param {number} [params.scenarioMultiplier=1.0] - Multiplier for Best (0.6), Expected (1.0), Worst (1.6)
 * @param {string} [params.regionalProfileId='WESTERN_GHATS_LATERITIC']
 * @returns {{
 *   timeline: Array<Object>,
 *   tauWatchHours: number | null,
 *   tauWarningHours: number | null,
 *   tauCriticalHours: number | null,
 *   criticalTriggerReached: boolean
 * }}
 */
export function simulateForecastScenario({
  initialState,
  forecastHyetograph = [],
  scenarioMultiplier = 1.0,
  regionalProfileId = 'WESTERN_GHATS_LATERITIC',
}) {
  let memory = { ...initialState.memory };
  let storm24h = Number(initialState.storm24hMm) || 0.0;
  let prevSmoothedRisk = Number(initialState.smoothedRisk) || 0.0;
  let currentState = initialState.state || SLOPE_STATES.HEALTHY;
  let prevLoadRatio = Number(initialState.loadRatio) || 0.0;
  let prevHMem = Number(initialState.hMemory) || 0.0;

  const tr = Number(initialState.triggerResistance) || 0.5;
  const historyForKinematics = [
    { timestampMs: Date.now() - 3600000, smoothedRisk: prevSmoothedRisk },
    { timestampMs: Date.now(), smoothedRisk: prevSmoothedRisk },
  ];

  let tauWatchHours = null;
  let tauWarningHours = null;
  let tauCriticalHours = null;

  const timeline = [];

  for (let i = 0; i < forecastHyetograph.length; i++) {
    const step = forecastHyetograph[i];
    const hour = step.hourOffset ?? i + 1;
    const rawRain = Number(step.expectedRainMm) || 0.0;
    const rain = Math.max(0.0, rawRain * scenarioMultiplier);

    // Update 24h rolling accumulation (simplified linear sliding window)
    storm24h = Math.max(0.0, storm24h * 0.95 + rain);

    // Advance 3-timescale memory
    memory = advanceSlopeMemory(memory, rain, 1.0, regionalProfileId);
    const memResult = computeCompositeMemoryIndex(memory, regionalProfileId);

    // Compute load and load ratio
    const loadResult = computeHydrologicalLoad({
      intensityMmPerHour: rain,
      storm24hMm: storm24h,
      memory,
      triggerResistance: tr,
      regionalProfileId,
    });

    // Operational hazard & smoothing
    const rawHazard = Math.min(1.0, loadResult.loadRatio * (1.0 - tr * 0.5));
    const smoothedHazard = smoothRisk(rawHazard, prevSmoothedRisk);
    prevSmoothedRisk = smoothedHazard;

    historyForKinematics.push({
      timestampMs: Date.now() + hour * 3600000,
      smoothedRisk: smoothedHazard,
    });

    const kinematics = computeHazardKinematics(historyForKinematics.slice(-4));

    // Evaluate state machine
    const stateEval = evaluateSlopeState({
      previousState: currentState,
      loadRatio: loadResult.loadRatio,
      previousLoadRatio: prevLoadRatio,
      normalizedMemory: memResult,
      previousHMemory: prevHMem,
      riskVelocityPerHr: kinematics.riskVelocityPerHr,
      riskAccelerationPerHr2: kinematics.riskAccelerationPerHr2,
      rainfallIntensityMmPerHour: rain,
    });

    currentState = stateEval.state;
    prevLoadRatio = loadResult.loadRatio;
    prevHMem = memResult.hMemory;

    timeline.push({
      hourOffset: hour,
      rainMm: Math.round(rain * 10) / 10,
      loadRatio: loadResult.loadRatio,
      hazard: smoothedHazard,
      state: currentState,
      memoryFast: memory.fastMm,
      memoryMed: memory.mediumMm,
      memorySlow: memory.slowMm,
    });

    // Check threshold crossings
    if (tauWatchHours === null && (loadResult.loadRatio >= 0.55 || currentState === SLOPE_STATES.LOADING)) {
      tauWatchHours = hour;
    }
    if (tauWarningHours === null && (loadResult.loadRatio >= 0.80 || currentState === SLOPE_STATES.SATURATING || currentState === SLOPE_STATES.UNSTABLE)) {
      tauWarningHours = hour;
    }
    if (tauCriticalHours === null && (loadResult.loadRatio >= 1.0 || currentState === SLOPE_STATES.CRITICAL)) {
      tauCriticalHours = hour;
    }
  }

  return {
    timeline,
    tauWatchHours,
    tauWarningHours,
    tauCriticalHours,
    criticalTriggerReached: tauCriticalHours !== null,
  };
}

/**
 * Generate 3-Scenario Ensemble Forecast (Best, Expected, Worst Case).
 *
 * @param {Object} params
 * @param {Object} params.initialState
 * @param {Array<{ hourOffset: number, expectedRainMm: number }>} params.forecastHyetograph
 * @param {string} [params.regionalProfileId='WESTERN_GHATS_LATERITIC']
 * @returns {{
 *   bestCase: Object,
 *   expectedCase: Object,
 *   worstCase: Object,
 *   ensembleSummary: {
 *     watchWindowHours: { min: number|null, max: number|null },
 *     warningWindowHours: { min: number|null, max: number|null },
 *     criticalWindowHours: { min: number|null, max: number|null },
 *     criticalPossibility: 'NONE' | 'POSSIBLE_IN_EXTREME_SCENARIO' | 'LIKELY' | 'IMMINENT'
 *   }
 * }}
 */
export function generateEnsembleForecast({
  initialState,
  forecastHyetograph = [],
  regionalProfileId = 'WESTERN_GHATS_LATERITIC',
}) {
  const bestCase = simulateForecastScenario({
    initialState,
    forecastHyetograph,
    scenarioMultiplier: 0.60,
    regionalProfileId,
  });

  const expectedCase = simulateForecastScenario({
    initialState,
    forecastHyetograph,
    scenarioMultiplier: 1.0,
    regionalProfileId,
  });

  const worstCase = simulateForecastScenario({
    initialState,
    forecastHyetograph,
    scenarioMultiplier: 1.60,
    regionalProfileId,
  });

  let criticalPossibility = 'NONE';
  if (expectedCase.criticalTriggerReached) {
    criticalPossibility = expectedCase.tauCriticalHours <= 3 ? 'IMMINENT' : 'LIKELY';
  } else if (worstCase.criticalTriggerReached) {
    criticalPossibility = 'POSSIBLE_IN_EXTREME_SCENARIO';
  }

  return {
    bestCase,
    expectedCase,
    worstCase,
    ensembleSummary: {
      watchWindowHours: {
        earliestHours: worstCase.tauWatchHours,
        expectedHours: expectedCase.tauWatchHours,
        latestHours: bestCase.tauWatchHours,
      },
      warningWindowHours: {
        earliestHours: worstCase.tauWarningHours,
        expectedHours: expectedCase.tauWarningHours,
        latestHours: bestCase.tauWarningHours,
      },
      criticalWindowHours: {
        earliestHours: worstCase.tauCriticalHours,
        expectedHours: expectedCase.tauCriticalHours,
        latestHours: bestCase.tauCriticalHours,
      },
      criticalPossibility,
    },
  };
}
