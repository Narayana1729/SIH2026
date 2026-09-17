/**
 * @module disasters/landslide/engines/slopeStateMachine
 * @description Non-Linear Slope State Machine with Hydrological Hysteresis & Recovery.
 * Evaluates multi-variable state vectors X(t) = [L, M_f, M_m, M_s, V_R, A_R, D]
 * preventing instant recovery after storm cessation.
 */

export const SLOPE_STATES = {
  HEALTHY: 'HEALTHY',         // Low stress, stable baseline
  LOADING: 'LOADING',         // Early storm infiltration / rapid positive momentum
  SATURATING: 'SATURATING',   // Significant subsoil saturation & elevated medium memory
  UNSTABLE: 'UNSTABLE',       // Near-threshold loading with positive momentum
  CRITICAL: 'CRITICAL',       // Threshold breached or physical failure indicators active
  RECOVERY: 'RECOVERY',       // Post-storm drainage & gradual dissipation of pore pressure
};

/**
 * Evaluate the next slope state using multi-variable state vectors and hysteresis rules.
 *
 * @param {Object} params
 * @param {string} [params.previousState='HEALTHY'] - State in preceding timestep
 * @param {number} params.loadRatio - Current dimensionless load ratio (L = LoadIndex / TR)
 * @param {number} [params.previousLoadRatio=0.0] - Preceding load ratio for dL/dt calculation
 * @param {Object} params.normalizedMemory - { normalizedFast, normalizedMed, normalizedSlow, hMemory }
 * @param {number} [params.previousHMemory=0.0] - Preceding memory index for dH/dt calculation
 * @param {number} params.riskVelocityPerHr - Hazard momentum V_R (1/hr)
 * @param {number} [params.riskAccelerationPerHr2=0.0] - Hazard acceleration A_R (1/hr^2)
 * @param {number} [params.rainfallIntensityMmPerHour=0.0] - Current rainfall rate
 * @param {number|null} [params.factorOfSafety=null] - Mechanical FS (Sentinel Mode only)
 * @param {number|null} [params.groundDeformationMm=null] - InSAR / sensor displacement (Sentinel Mode only)
 * @returns {{
 *   state: string,
 *   previousState: string,
 *   stateReason: string,
 *   isHysteresisActive: boolean
 * }}
 */
export function evaluateSlopeState({
  previousState = SLOPE_STATES.HEALTHY,
  loadRatio = 0.0,
  previousLoadRatio = 0.0,
  normalizedMemory = {},
  previousHMemory = 0.0,
  riskVelocityPerHr = 0.0,
  riskAccelerationPerHr2 = 0.0,
  rainfallIntensityMmPerHour = 0.0,
  factorOfSafety = null,
  groundDeformationMm = null,
}) {
  const L = Math.max(0.0, Number(loadRatio) || 0.0);
  const prevL = Math.max(0.0, Number(previousLoadRatio) || 0.0);
  const vR = Number(riskVelocityPerHr) || 0.0;
  const pRate = Math.max(0.0, Number(rainfallIntensityMmPerHour) || 0.0);

  const hMem = Number(normalizedMemory.hMemory || 0.0);
  const prevHMem = Number(previousHMemory || 0.0);
  const normMed = Number(normalizedMemory.normalizedMed || 0.0);

  const dHMem = hMem - prevHMem;
  const dL = L - prevL;

  // 1. Sentinel Mode Overrides: Physical Collapse Signal
  if (factorOfSafety !== null && factorOfSafety <= 1.05) {
    return {
      state: SLOPE_STATES.CRITICAL,
      previousState,
      stateReason: `Sentinel Physical Trigger: Mechanical Factor of Safety collapsed to FS = ${factorOfSafety.toFixed(2)}`,
      isHysteresisActive: false,
    };
  }
  if (groundDeformationMm !== null && groundDeformationMm >= 15.0) {
    return {
      state: SLOPE_STATES.CRITICAL,
      previousState,
      stateReason: `Sentinel Physical Trigger: Cumulative ground deformation reached ${groundDeformationMm.toFixed(1)} mm`,
      isHysteresisActive: false,
    };
  }

  // 2. Critical Condition: Load Ratio >= 1.0
  if (L >= 1.0) {
    return {
      state: SLOPE_STATES.CRITICAL,
      previousState,
      stateReason: `Critical Trigger Breached: Hydrological Load Ratio (L = ${L.toFixed(2)}) crossed calibrated threshold (TR = 1.0)`,
      isHysteresisActive: false,
    };
  }

  // 3. Post-Storm Recovery & Hysteresis Check:
  // When rain stops or is negligible, but the slope previously entered CRITICAL, UNSTABLE, or SATURATING,
  // it must enter RECOVERY rather than immediately snapping to HEALTHY.
  const wasHighStress =
    previousState === SLOPE_STATES.CRITICAL ||
    previousState === SLOPE_STATES.UNSTABLE ||
    previousState === SLOPE_STATES.SATURATING ||
    previousState === SLOPE_STATES.RECOVERY;

  const isDraining = (pRate <= 1.5) && (dHMem <= 0.005) && (dL <= 0.01);

  if (wasHighStress && isDraining) {
    // Slopes only fully exit RECOVERY when Load Ratio drops below 0.35 and medium subsoil memory drains below 0.35
    if (L < 0.35 && normMed < 0.35) {
      return {
        state: SLOPE_STATES.HEALTHY,
        previousState,
        stateReason: `Recovery Complete: Pore water drained (L = ${L.toFixed(2)}, subsoil memory = ${normMed.toFixed(2)})`,
        isHysteresisActive: false,
      };
    }
    if (L < 0.55) {
      return {
        state: SLOPE_STATES.LOADING,
        previousState,
        stateReason: `Transitioning out of Recovery: Residual moisture dissipating (L = ${L.toFixed(2)})`,
        isHysteresisActive: true,
      };
    }
    return {
      state: SLOPE_STATES.RECOVERY,
      previousState,
      stateReason: `Hydrological Hysteresis: Rain ceased but deep subsoil pore pressure remains elevated (L = ${L.toFixed(2)}, Medium Memory = ${normMed.toFixed(2)})`,
      isHysteresisActive: true,
    };
  }

  // 4. Unstable Condition (0.85 <= L < 1.0 with positive momentum or prior high state)
  if (L >= 0.85) {
    return {
      state: SLOPE_STATES.UNSTABLE,
      previousState,
      stateReason: `High Instability Zone: Load Ratio (L = ${L.toFixed(2)}) approaching critical failure boundary`,
      isHysteresisActive: false,
    };
  }

  // 5. Saturating Condition (0.65 <= L < 0.85, especially when medium subsoil memory is elevated)
  if (L >= 0.65 || (L >= 0.55 && normMed >= 0.60)) {
    return {
      state: SLOPE_STATES.SATURATING,
      previousState,
      stateReason: `Subsoil Saturation Rising: Elevated antecedent wetting (L = ${L.toFixed(2)}, Medium Memory = ${normMed.toFixed(2)})`,
      isHysteresisActive: false,
    };
  }

  // 6. Loading Condition (0.40 <= L < 0.65 or rapid positive velocity surge)
  if (L >= 0.40 || vR >= 0.05) {
    return {
      state: SLOPE_STATES.LOADING,
      previousState,
      stateReason: vR >= 0.05
        ? `Rapid Kinematic Infiltration Surge: Velocity V_R = +${vR.toFixed(3)}/hr`
        : `Active Hydrological Loading: Moderate rainfall infiltration (L = ${L.toFixed(2)})`,
      isHysteresisActive: false,
    };
  }

  // 7. Baseline Healthy State
  return {
    state: SLOPE_STATES.HEALTHY,
    previousState,
    stateReason: `Stable Baseline: Low hydrological stress (L = ${L.toFixed(2)}, V_R = ${vR.toFixed(3)}/hr)`,
    isHysteresisActive: false,
  };
}
