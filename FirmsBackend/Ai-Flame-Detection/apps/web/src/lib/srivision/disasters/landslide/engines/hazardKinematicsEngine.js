/**
 * @module disasters/landslide/engines/hazardKinematicsEngine
 * @description Hazard Momentum & Kinematic Escalation Engine.
 * Computes Exponentially Smoothed Hazard, Risk Velocity (V_R), Risk Acceleration (A_R),
 * and flags rapid escalation surges before absolute critical thresholds are breached.
 */

/**
 * Apply Exponential Moving Average (EMA) smoothing to filter high-frequency sensor noise.
 *
 * @param {number} rawRisk - Current raw risk value in [0, 1]
 * @param {number} previousSmoothedRisk - Previous smoothed risk value in [0, 1]
 * @param {number} [alpha=0.35] - Smoothing factor in (0, 1]
 * @returns {number} Smoothed risk in [0, 1]
 */
export function smoothRisk(rawRisk, previousSmoothedRisk, alpha = 0.35) {
  const rRaw = Math.max(0.0, Math.min(1.0, Number(rawRisk) || 0.0));
  if (previousSmoothedRisk === null || previousSmoothedRisk === undefined) {
    return rRaw;
  }
  const rPrev = Math.max(0.0, Math.min(1.0, Number(previousSmoothedRisk) || 0.0));
  const a = Math.max(0.05, Math.min(1.0, Number(alpha) || 0.35));
  const smoothed = a * rRaw + (1.0 - a) * rPrev;
  return Math.round(smoothed * 1000) / 1000;
}

/**
 * Compute hazard velocity (V_R) and acceleration (A_R) from time series history.
 *
 * @param {Array<{ timestampMs: number, smoothedRisk: number }>} history - Chronological history
 * @returns {{
 *   currentSmoothedRisk: number,
 *   riskVelocityPerHr: number,
 *   riskAccelerationPerHr2: number,
 *   trend: 'RAPIDLY_ESCALATING' | 'ESCALATING' | 'STABLE' | 'DECREASING' | 'RAPIDLY_DECREASING',
 *   escalationAlert: boolean
 * }}
 */
export function computeHazardKinematics(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      currentSmoothedRisk: 0.0,
      riskVelocityPerHr: 0.0,
      riskAccelerationPerHr2: 0.0,
      trend: 'STABLE',
      escalationAlert: false,
    };
  }

  const n = history.length;
  const current = history[n - 1];
  const currentRisk = Number(current.smoothedRisk ?? current.hazard ?? 0.0);

  if (n === 1) {
    return {
      currentSmoothedRisk: Math.round(currentRisk * 1000) / 1000,
      riskVelocityPerHr: 0.0,
      riskAccelerationPerHr2: 0.0,
      trend: 'STABLE',
      escalationAlert: false,
    };
  }

  const prev = history[n - 2];
  const prevRisk = Number(prev.smoothedRisk ?? prev.hazard ?? 0.0);
  const dtHours = Math.max(0.1, (Number(current.timestampMs || 0) - Number(prev.timestampMs || 0)) / 3600000.0) || 1.0;

  // Velocity (1/hr)
  const vR = (currentRisk - prevRisk) / dtHours;

  // Acceleration (1/hr^2)
  let aR = 0.0;
  if (n >= 3) {
    const prev2 = history[n - 3];
    const prev2Risk = Number(prev2.smoothedRisk ?? prev2.hazard ?? 0.0);
    const dtPrevHours = Math.max(0.1, (Number(prev.timestampMs || 0) - Number(prev2.timestampMs || 0)) / 3600000.0) || 1.0;
    const vRPrev = (prevRisk - prev2Risk) / dtPrevHours;
    aR = (vR - vRPrev) / dtHours;
  }

  // Trend categorization
  let trend = 'STABLE';
  if (vR >= 0.08) trend = 'RAPIDLY_ESCALATING';
  else if (vR >= 0.03) trend = 'ESCALATING';
  else if (vR <= -0.08) trend = 'RAPIDLY_DECREASING';
  else if (vR <= -0.03) trend = 'DECREASING';

  // Rapid escalation warning flagged if momentum is high even if current score is moderate
  const escalationAlert = vR >= 0.05 || (vR >= 0.03 && aR > 0.01);

  return {
    currentSmoothedRisk: Math.round(currentRisk * 1000) / 1000,
    riskVelocityPerHr: Math.round(vR * 1000) / 1000,
    riskAccelerationPerHr2: Math.round(aR * 1000) / 1000,
    trend,
    escalationAlert,
  };
}
