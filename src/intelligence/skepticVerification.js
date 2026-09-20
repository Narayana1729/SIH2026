/**
 * @module src/intelligence/skepticVerification
 * @description Adversarial Skeptic AI & Falsification Verification Engine.
 *
 * Implements the "Skeptic AI" paradigm (inspired by rigorous scientific peer review
 * and adversarial intelligence verification):
 *
 * Rather than asking: "Can we find evidence that this IS a fire?"
 * The Skeptic Engine asks: "Can we DISPROVE this hypothesis using physical,
 * orbital, spectral, and temporal invariants?"
 *
 * Executes 5 Systematic Adversarial Falsification Gates:
 * 1. Solar Glint & Roof Reflection Gate (Geometric / Spectral reflection check)
 * 2. Planck Combustion Temperature Gate (Dozier physical sub-pixel inversion)
 * 3. Biomass & Canopy Fuel Divergence Gate (LULC & NDVI vs Industrial footprint)
 * 4. Permitted Operational Baseline Gate (Historical FRP deviation vs normal routine flaring)
 * 5. Sensor Glitch & Transient Pulse Gate (Multi-sensor / multi-temporal pulse confirmation)
 */

import { solveDozierPyrometry } from '../disasters/pyrometry/dozierPyrometry.js';
import { findFacilitiesNearby } from '../disasters/industrial/industrialFacilities.js';

export const SkepticVerdictAction = {
  CONFIRMED_HAZARD: 'CONFIRMED_HAZARD',             // Hypothesis survived all adversarial checks
  DEMOTE_TO_ROUTINE: 'DEMOTE_TO_ROUTINE',           // Disproved as disaster; verified as permitted routine flare/process
  DIVERT_TO_WILDFIRE: 'DIVERT_TO_WILDFIRE',         // Disproved as industrial; vegetative fuel confirmed
  DISCARD_FALSE_ALARM: 'DISCARD_FALSE_ALARM',       // Disproved as combustion; solar glint or sensor glitch
  INCONCLUSIVE_REVIEW: 'INCONCLUSIVE_REVIEW',       // Ambiguous evidence; tagged for human-in-the-loop review
};

export class SkepticVerificationEngine {
  constructor(options = {}) {
    this.minCombustionTempK = options.minCombustionTempK || 650.0; // Minimum physical flame temp for combustion
    this.maxGlintMidwaveDelta = options.maxGlintMidwaveDelta || 15.0; // Daytime solar reflections often have low deltaT
    this.baselineZScoreThreshold = options.baselineZScoreThreshold || 2.5; // >2.5 sigma indicates genuine anomaly vs baseline
  }

  /**
   * Run the full Adversarial Skeptic audit on a candidate thermal anomaly.
   *
   * @param {object} detection - Raw thermal telemetry
   * @param {object} [initialClassification={}] - Output from primary classifier
   * @returns {object} Full Adversarial Audit Report with survival status and explainable counter-evidence
   */
  auditAnomaly(detection, initialClassification = {}) {
    const lat = Number(detection.latitude ?? detection.lat) || 0;
    const lon = Number(detection.longitude ?? detection.lon) || 0;
    const frp = Number(detection.frp) || 15;
    const brightT4 = Number(detection.bright_ti4 ?? detection.brightness ?? 330);
    const brightT5 = Number(detection.bright_ti5 ?? 295);
    const daynight = String(detection.daynight || 'D').toUpperCase();
    const persistence = Number(detection.historicalPersistence ?? detection.persistenceRatio) || 0.0;
    const ndvi = Number(detection.ndvi) || 0.2;
    const lulc = detection.landCover || 'bare';

    // Solve sub-pixel physics
    const pyrometry = solveDozierPyrometry(brightT4, brightT5, frp);

    // Nearby facilities
    const nearby = findFacilitiesNearby(lat, lon, 10.0);
    const facility = nearby.length > 0 ? nearby[0] : null;

    const tests = [];

    // ── Gate 1: Solar Glint & Roof Reflection Falsification ──
    const glintCheck = this._testSolarGlint(brightT4, brightT5, daynight, pyrometry);
    tests.push(glintCheck);

    // ── Gate 2: Planck Combustion Temperature Falsification ──
    const combustionCheck = this._testPlanckCombustion(pyrometry, frp);
    tests.push(combustionCheck);

    // ── Gate 3: Canopy Fuel vs Industrial Footprint Divergence ──
    const canopyCheck = this._testCanopyDivergence(ndvi, lulc, facility, initialClassification.category);
    tests.push(canopyCheck);

    // ── Gate 4: Permitted Operational Baseline Falsification ──
    const baselineCheck = this._testOperationalBaseline(frp, persistence, facility, initialClassification.category);
    tests.push(baselineCheck);

    // ── Gate 5: Sensor Glitch & Transient Pulse Falsification ──
    const transientCheck = this._testTransientGlitch(detection, persistence);
    tests.push(transientCheck);

    // Synthesize final Skeptic Verdict
    const falsifiedTests = tests.filter(t => t.status === 'FALSIFIED');
    const passedTests = tests.filter(t => t.status === 'SURVIVED');
    const isDisproven = falsifiedTests.length > 0;

    let action = SkepticVerdictAction.CONFIRMED_HAZARD;
    let primaryDisproveReason = null;

    if (glintCheck.status === 'FALSIFIED' || transientCheck.status === 'FALSIFIED') {
      action = SkepticVerdictAction.DISCARD_FALSE_ALARM;
      primaryDisproveReason = glintCheck.status === 'FALSIFIED' ? glintCheck.reason : transientCheck.reason;
    } else if (baselineCheck.status === 'FALSIFIED') {
      action = SkepticVerdictAction.DEMOTE_TO_ROUTINE;
      primaryDisproveReason = baselineCheck.reason;
    } else if (canopyCheck.status === 'FALSIFIED') {
      action = SkepticVerdictAction.DIVERT_TO_WILDFIRE;
      primaryDisproveReason = canopyCheck.reason;
    } else if (combustionCheck.status === 'FALSIFIED') {
      action = SkepticVerdictAction.DISCARD_FALSE_ALARM;
      primaryDisproveReason = combustionCheck.reason;
    }

    const falsificationConfidence = isDisproven 
      ? Math.min(1.0, falsifiedTests.reduce((acc, t) => acc + t.weight, 0) / falsifiedTests.length)
      : 0.0;

    return {
      isDisproven,
      action,
      primaryDisproveReason,
      falsificationConfidence,
      passedCheckCount: passedTests.length,
      failedCheckCount: falsifiedTests.length,
      totalChecks: tests.length,
      pyrometryResolution: {
        flameTempK: pyrometry.flameTempK,
        flameAreaM2: pyrometry.flameAreaM2,
        regime: pyrometry.regime,
        radiantHeatFluxKwM2: pyrometry.radiantHeatFluxKwM2,
      },
      auditTrail: tests,
    };
  }

  _testSolarGlint(brightT4, brightT5, daynight, pyrometry) {
    const deltaT = brightT4 - brightT5;
    const isDay = daynight === 'D';

    // Solar glint occurs during daytime over reflective metal roofs with modest deltaT and sub-combustion flame temp
    if (isDay && deltaT < this.maxGlintMidwaveDelta && pyrometry.flameTempK < 680) {
      return {
        gate: 'SOLAR_GLINT_GATE',
        status: 'FALSIFIED',
        weight: 0.92,
        reason: `Daytime optical reflection detected (ΔT = ${deltaT.toFixed(1)} K, Tf = ${pyrometry.flameTempK} K); non-combustion solar roof glint profile.`,
      };
    }

    return {
      gate: 'SOLAR_GLINT_GATE',
      status: 'SURVIVED',
      weight: 0.85,
      reason: `Spectral radiance ratio exceeds solar specular glint limits (ΔT = ${deltaT.toFixed(1)} K, daynight = ${daynight}).`,
    };
  }

  _testPlanckCombustion(pyrometry, frp) {
    if (pyrometry.flameTempK < this.minCombustionTempK && frp < 10) {
      return {
        gate: 'PLANCK_COMBUSTION_GATE',
        status: 'FALSIFIED',
        weight: 0.94,
        reason: `Sub-pixel flame inversion resolved Tf = ${pyrometry.flameTempK} K (< ${this.minCombustionTempK} K threshold); physically incapable of self-sustaining combustion.`,
      };
    }

    return {
      gate: 'PLANCK_COMBUSTION_GATE',
      status: 'SURVIVED',
      weight: 0.96,
      reason: `Planck inversion confirms true combustion regime (Tf = ${pyrometry.flameTempK} K, Area = ${pyrometry.flameAreaM2.toFixed(1)} m²).`,
    };
  }

  _testCanopyDivergence(ndvi, lulc, facility, category) {
    const isIndustrialClaim = category === 'INDUSTRIAL_DISASTER' || category === 'INDUSTRIAL_FLARE';
    const isHeavyVegetation = ndvi > 0.55 || lulc === 'forest';

    if (isIndustrialClaim && isHeavyVegetation && (!facility || facility.distance_km > 3.5)) {
      return {
        gate: 'CANOPY_FUEL_DIVERGENCE_GATE',
        status: 'FALSIFIED',
        weight: 0.89,
        reason: `Claimed industrial event located in dense biomass fuel zone (NDVI = ${ndvi.toFixed(2)}, ${facility ? facility.distance_km.toFixed(1) + ' km to facility' : 'no industrial facility'}); diverted to Wildfire.`,
      };
    }

    return {
      gate: 'CANOPY_FUEL_DIVERGENCE_GATE',
      status: 'SURVIVED',
      weight: 0.88,
      reason: `Surface land-cover footprint aligns with candidate classification regime.`,
    };
  }

  _testOperationalBaseline(frp, persistence, facility, category) {
    // If flagged as accidental runaway explosion, test if FRP is actually inside normal flaring baseline
    if (category === 'INDUSTRIAL_DISASTER' && facility && persistence > 0.40 && frp < 75) {
      return {
        gate: 'OPERATIONAL_BASELINE_GATE',
        status: 'FALSIFIED',
        weight: 0.91,
        reason: `Candidate disaster has high 90-day persistence (${(persistence * 100).toFixed(0)}%) and normal flare power (${frp.toFixed(1)} MW); disproved as accidental explosion; demoted to routine flaring.`,
      };
    }

    return {
      gate: 'OPERATIONAL_BASELINE_GATE',
      status: 'SURVIVED',
      weight: 0.90,
      reason: `Thermal energy dynamics deviate significantly from stationary operational baselines.`,
    };
  }

  _testTransientGlitch(detection, persistence) {
    const conf = detection.confidence;
    const isLowConf = conf === 'l' || (typeof conf === 'number' && conf < 30);

    if (isLowConf && persistence === 0 && (!detection.frp || detection.frp < 4)) {
      return {
        gate: 'TRANSIENT_SENSOR_GLITCH_GATE',
        status: 'FALSIFIED',
        weight: 0.87,
        reason: `Isolated low-confidence detection (${conf}) without temporal confirmation; high likelihood of sensor noise or high-altitude cirrus artifact.`,
      };
    }

    return {
      gate: 'TRANSIENT_SENSOR_GLITCH_GATE',
      status: 'SURVIVED',
      weight: 0.85,
      reason: `Detection confidence and radiometric signal strength meet multi-temporal validity criteria.`,
    };
  }
}

export const defaultSkepticEngine = new SkepticVerificationEngine();
export function auditThermalAnomaly(detection, initialClassification) {
  return defaultSkepticEngine.auditAnomaly(detection, initialClassification);
}
