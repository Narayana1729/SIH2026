/**
 * @module disasters/landslide/engines/slopeIntelligenceEngine
 * @description Master Orchestrator for the Slope Intelligence System (SIE).
 * Implements State Estimation Under Partial Observability, 3-Layer Sentinel Evidence,
 * and Scenario-Dependent Rainfall Forcing Budgets.
 */

import { computeTriggerResistance } from './terrainEngine.js';
import { advanceSlopeMemory, computeCompositeMemoryIndex } from './slopeMemoryEngine.js';
import { computeHydrologicalLoad, computeScenarioRainfallForcingBudgets } from './hydrologicalStressEngine.js';
import { smoothRisk, computeHazardKinematics } from './hazardKinematicsEngine.js';
import { evaluateSlopeState, SLOPE_STATES } from './slopeStateMachine.js';
import { generateEnsembleForecast } from './failureForecastEngine.js';
import { computeFactorOfSafety } from '../landslideRisk.js';
import { TELEMETRY_PROVENANCE } from '../data/sentinelSlopesData.js';
import { createDataProvenance, SOURCE_TYPES } from '../../../core/provenance.js';

/**
 * Compute the Multi-Source Confidence Score based on telemetry availability.
 *
 * @param {Object} telemetry - Provenance map of input streams
 * @returns {{ level: 'HIGH' | 'MODERATE' | 'LOW' | 'SYNTHETIC_ONLY', score: number, rationale: string }}
 */
export function computeTelemetryConfidence(telemetry = {}) {
  let score = 0.0;
  const factors = [];

  const rainSource = telemetry.rainfallIntensity?.source || TELEMETRY_PROVENANCE.UNAVAILABLE;
  if (rainSource === TELEMETRY_PROVENANCE.OBSERVED) {
    score += 0.40;
    factors.push('Calibrated in-situ AWS rain gauge active');
  } else if (rainSource === TELEMETRY_PROVENANCE.MODELLED || rainSource === TELEMETRY_PROVENANCE.SYNTHETIC) {
    score += 0.20;
    factors.push('Spatial radar/satellite precipitation reanalysis');
  }

  const soilSource = telemetry.soilMoisture?.source || TELEMETRY_PROVENANCE.UNAVAILABLE;
  if (soilSource === TELEMETRY_PROVENANCE.OBSERVED) {
    score += 0.30;
    factors.push('In-situ dielectric soil moisture probes');
  } else if (soilSource === TELEMETRY_PROVENANCE.MODELLED) {
    score += 0.15;
    factors.push('Modeled subsoil water-balance layer');
  }

  const defSource = telemetry.groundDeformation?.source || TELEMETRY_PROVENANCE.UNAVAILABLE;
  if (defSource === TELEMETRY_PROVENANCE.OBSERVED || defSource === TELEMETRY_PROVENANCE.MODELLED) {
    score += 0.30;
    factors.push('Long-term InSAR structural displacement history');
  }

  score = Math.min(1.0, Math.max(0.15, score));

  let level = 'LOW';
  if (score >= 0.70) level = 'HIGH';
  else if (score >= 0.40) level = 'MODERATE';
  else if (rainSource === TELEMETRY_PROVENANCE.SYNTHETIC) level = 'SYNTHETIC_ONLY';

  return {
    level,
    score: Math.round(score * 100) / 100,
    rationale: factors.join(' + ') || 'Provisional estimates based on regional baselines',
  };
}

/**
 * Evaluate a complete Slope Digital Twin in Sentinel Mode using the 3-Layer Evidence Framework.
 *
 * @param {Object} slopeTwinData - Full sentinel slope record
 * @param {Object} [overrideTelemetry={}] - Live or simulated telemetry overrides
 * @param {Array<{ hourOffset: number, expectedRainMm: number }>} [forecastHyetograph=[]]
 * @returns {Object} Complete Living Slope Digital Twin State
 */
export function evaluateSentinelSlopeTwin(
  slopeTwinData,
  overrideTelemetry = {},
  forecastHyetograph = []
) {
  const profileId = slopeTwinData.regionalProfileId || 'WESTERN_GHATS_LATERITIC';

  // 1. Telemetry Ingestion
  const telemetry = {
    ...slopeTwinData.telemetry,
    ...overrideTelemetry,
  };

  const rainRate = Number(telemetry.rainfallIntensity?.valueMmPerHour ?? 0);
  const rain24h = Number(telemetry.rainfall24h?.valueMm ?? 0);
  const soilSat = Number(telemetry.soilMoisture?.valueSaturationPct ?? 50);
  const groundDefMm = telemetry.groundDeformation?.available ? Number(telemetry.groundDeformation.valueMm) : null;

  // 2. Layer 1: Terrain Identity & Relative Trigger Susceptibility (RTS)
  const rtsResult = computeTriggerResistance({
    terrain: slopeTwinData.terrain,
    soilVulnerability: slopeTwinData.terrain.soilVulnerability,
    historicalFailureDensity: slopeTwinData.terrain.historicalFailureDensity,
    regionalProfileId: profileId,
  });

  // 3. Layer 2: Multi-Timescale Slope Memory
  const memory = slopeTwinData.historicalMemory || { fastMm: 0, mediumMm: 0, slowMm: 0 };
  const memResult = computeCompositeMemoryIndex(memory, profileId);

  // 4. Layer 2: Hydrological Load & Scenario-Dependent Forcing Budgets
  const loadResult = computeHydrologicalLoad({
    intensityMmPerHour: rainRate,
    storm24hMm: rain24h,
    memory,
    triggerResistance: rtsResult.triggerResistance,
    regionalProfileId: profileId,
  });

  const scenarioForcingBudgets = computeScenarioRainfallForcingBudgets({
    currentIntensity: rainRate,
    currentStorm24h: rain24h,
    currentMemory: memory,
    triggerResistance: rtsResult.triggerResistance,
    regionalProfileId: profileId,
  });

  // 5. Hazard Kinematics & Momentum
  const rawHazard = Math.min(1.0, loadResult.loadRatio * rtsResult.vComposite);
  const smoothedHazard = smoothRisk(rawHazard, slopeTwinData.previousSmoothedRisk ?? rawHazard);

  const history = slopeTwinData.hazardHistory || [
    { timestampMs: Date.now() - 3600000, smoothedRisk: smoothedHazard * 0.92 },
    { timestampMs: Date.now(), smoothedRisk: smoothedHazard },
  ];
  const kinematics = computeHazardKinematics(history);

  // 6. Layer 3: Pre-Failure In-Situ Mechanical Confirmation
  let fs = null;
  if (slopeTwinData.geotechnical) {
    fs = computeFactorOfSafety({
      slopeDegrees: slopeTwinData.terrain.slopeDegrees,
      soilSaturationPct: soilSat,
      soilDepthMeters: slopeTwinData.geotechnical.soilDepthM,
      soilCohesionKPa: slopeTwinData.geotechnical.cohesionKPa,
      frictionAngleDeg: slopeTwinData.geotechnical.frictionAngleDeg,
    });
  }

  // 7. Non-Linear State Transition Machine
  const stateEval = evaluateSlopeState({
    previousState: slopeTwinData.previousState || SLOPE_STATES.HEALTHY,
    loadRatio: loadResult.loadRatio,
    previousLoadRatio: slopeTwinData.previousLoadRatio || 0.0,
    normalizedMemory: memResult,
    previousHMemory: slopeTwinData.previousHMemory || 0.0,
    riskVelocityPerHr: kinematics.riskVelocityPerHr,
    riskAccelerationPerHr2: kinematics.riskAccelerationPerHr2,
    rainfallIntensityMmPerHour: rainRate,
    factorOfSafety: fs,
    groundDeformationMm: groundDefMm,
  });

  // 8. Ensemble Forecast Simulation
  let forecastResults = null;
  if (forecastHyetograph && forecastHyetograph.length > 0) {
    forecastResults = generateEnsembleForecast({
      initialState: {
        memory,
        storm24hMm: rain24h,
        triggerResistance: rtsResult.triggerResistance,
        smoothedRisk: smoothedHazard,
        state: stateEval.state,
        loadRatio: loadResult.loadRatio,
        hMemory: memResult.hMemory,
      },
      forecastHyetograph,
      regionalProfileId: profileId,
    });
  }

  // 9. Telemetry Confidence
  const confidence = computeTelemetryConfidence(telemetry);

  return {
    mode: 'SENTINEL_SLOPE_TWIN',
    slopeId: slopeTwinData.slopeId,
    name: slopeTwinData.name,
    region: slopeTwinData.region,
    coordinates: slopeTwinData.coordinates,
    administrativeUnit: slopeTwinData.administrativeUnit,
    regionalProfileId: profileId,

    evidenceLayers: {
      layer1_terrainIdentity: {
        relativeTriggerSusceptibility: rtsResult.triggerResistance,
        terrainVulnerability: rtsResult.vTerrain,
        compositeVulnerability: rtsResult.vComposite,
        insarStructuralTrend: groundDefMm ? `${groundDefMm.toFixed(1)} mm baseline displacement` : 'Long-term baseline stable',
      },
      layer2_hydrologicalTriggering: {
        loadIndex: loadResult.loadIndex,
        loadRatio: loadResult.loadRatio,
        multiTimescaleMemory: {
          fastMm: memory.fastMm,
          mediumMm: memory.mediumMm,
          slowMm: memory.slowMm,
          compositeMemoryIndex: memResult.hMemory,
        },
        scenarioForcingBudgets,
      },
      layer3_preFailureConfirmation: {
        factorOfSafety: fs,
        stabilityVerdict: fs === null ? 'UNAVAILABLE' : fs < 1.05 ? 'CRITICAL_UNSTABLE' : fs < 1.3 ? 'MARGINALLY_STABLE' : 'STABLE',
        inSituDeformationMm: groundDefMm,
      },
    },

    stateMachine: {
      currentState: stateEval.state,
      previousState: stateEval.previousState,
      stateReason: stateEval.stateReason,
      isHysteresisActive: stateEval.isHysteresisActive,
    },

    kinematics: {
      operationalHazardScore100: Math.round(smoothedHazard * 100),
      rawHazard: Math.round(rawHazard * 1000) / 1000,
      riskVelocityPerHr: kinematics.riskVelocityPerHr,
      riskAccelerationPerHr2: kinematics.riskAccelerationPerHr2,
      trend: kinematics.trend,
      escalationAlert: kinematics.escalationAlert,
    },

    // Backward-compatibility accessors
    hydrologicalMetrics: {
      triggerResistance: rtsResult.triggerResistance,
      loadIndex: loadResult.loadIndex,
      loadRatio: loadResult.loadRatio,
      remainingTriggerBudgetMm: scenarioForcingBudgets.scenarioSustained3h.minMm,
      scenarioForcingBudgets,
    },
    slopeMemory: {
      fastMm: memory.fastMm,
      mediumMm: memory.mediumMm,
      slowMm: memory.slowMm,
      compositeMemoryIndex: memResult.hMemory,
    },
    sentinelPhysicalMechanics: {
      factorOfSafety: fs,
      stabilityVerdict: fs === null ? 'UNAVAILABLE' : fs < 1.05 ? 'UNSTABLE' : fs < 1.3 ? 'MARGINALLY_STABLE' : 'STABLE',
      inSarDisplacementMm: groundDefMm,
    },

    forecastEnsemble: forecastResults,
    confidence,

    provenance: createDataProvenance({
      source: 'sriVision Slope Intelligence Engine (SIE)',
      sourceType: SOURCE_TYPES.SIMULATED,
      confidenceType: 'STATE_ESTIMATION_UNDER_PARTIAL_OBSERVABILITY',
      limitations: [
        'Scenario forcing budgets represent bounded counterfactual models and assume standard temporal storm hyetographs.',
        'Forecast windows are probabilistic scenarios (Best/Expected/Worst) and should not be construed as deterministic collapse timestamps.',
      ],
    }),
  };
}

/**
 * Evaluate a Regional Grid Cell in Regional Mode.
 */
export function evaluateRegionalSlopeCell({
  cellId = 'GRID-CELL-001',
  coordinates = { latitude: 0, longitude: 0, elevationM: 500 },
  slopeDegrees = 30.0,
  twiNormalized = 0.5,
  profileCurvature = 0.0,
  soilVulnerability = 0.5,
  historicalFailureDensity = 0.3,
  rainfallIntensityMmPerHour = 10.0,
  storm24hMm = 50.0,
  memory = { fastMm: 10, mediumMm: 40, slowMm: 100 },
  regionalProfileId = 'WESTERN_GHATS_LATERITIC',
}) {
  const rtsResult = computeTriggerResistance({
    terrain: { slopeDegrees, twiNormalized, profileCurvature },
    soilVulnerability,
    historicalFailureDensity,
    regionalProfileId,
  });

  const memResult = computeCompositeMemoryIndex(memory, regionalProfileId);

  const loadResult = computeHydrologicalLoad({
    intensityMmPerHour: rainfallIntensityMmPerHour,
    storm24hMm,
    memory,
    triggerResistance: rtsResult.triggerResistance,
    regionalProfileId,
  });

  const scenarioForcingBudgets = computeScenarioRainfallForcingBudgets({
    currentIntensity: rainfallIntensityMmPerHour,
    currentStorm24h: storm24hMm,
    currentMemory: memory,
    triggerResistance: rtsResult.triggerResistance,
    regionalProfileId,
  });

  const rawHazard = Math.min(1.0, loadResult.loadRatio * rtsResult.vComposite);

  const stateEval = evaluateSlopeState({
    previousState: SLOPE_STATES.HEALTHY,
    loadRatio: loadResult.loadRatio,
    normalizedMemory: memResult,
    riskVelocityPerHr: 0.0,
    rainfallIntensityMmPerHour,
    factorOfSafety: null,
    groundDeformationMm: null,
  });

  return {
    mode: 'REGIONAL_GRID_MODE',
    cellId,
    coordinates,
    regionalProfileId,
    stateMachine: {
      currentState: stateEval.state,
      stateReason: stateEval.stateReason,
    },
    hydrologicalMetrics: {
      relativeTriggerSusceptibility: rtsResult.triggerResistance,
      loadIndex: loadResult.loadIndex,
      loadRatio: loadResult.loadRatio,
      scenarioForcingBudgets,
    },
    slopeMemory: {
      compositeMemoryIndex: memResult.hMemory,
    },
    hazardScore100: Math.round(rawHazard * 100),
    confidence: {
      level: 'MODERATE',
      score: 0.50,
      rationale: 'Regional spatial interpolation without localized geotechnical instrumentation',
    },
  };
}
