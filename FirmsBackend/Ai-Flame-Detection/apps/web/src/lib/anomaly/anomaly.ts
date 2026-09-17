import type { ThermalEvent } from "../../types/event.ts";

export type AnomalySeverity = "NOMINAL" | "MODERATE_DEVIATION" | "CRITICAL_SURGE";

export interface ThermalAnomalyProfile {
  eventId: string;
  isIndustrial: boolean;
  baselineFrpMw: number;
  baselineRangeLabel: string;
  currentFrpMw: number;
  frpDeltaMw: number;
  deviationPercent: number;
  zScore: number;
  severity: AnomalySeverity;
  anomalyTitle: string;
  anomalyDescription: string;
  isEarlyWarningAlert: boolean;
}

/**
 * Computes baseline deviation and early-warning anomaly indicators for industrial flaring.
 */
export function computeThermalAnomalyProfile(event: ThermalEvent): ThermalAnomalyProfile {
  const isIndustrial = event.classification === "INDUSTRIAL";
  const currentFrp = typeof event.frp_mw === "number" && !isNaN(event.frp_mw) ? event.frp_mw : 25.0;

  // Establish historical baseline expectations
  // Heavy refineries/steel mills nominal flare baseline: 80 - 120 MW (mean ~95 MW, std ~18 MW)
  // Non-industrial biomass baseline: 15 - 35 MW (mean ~25 MW, std ~8 MW)
  const baselineMean = isIndustrial ? 95.0 : 25.0;
  const baselineStd = isIndustrial ? 20.0 : 9.0;
  const baselineRangeLabel = isIndustrial ? "80 – 120 MW" : "15 – 35 MW";

  const frpDelta = currentFrp - baselineMean;
  const deviationPercent = Number(((frpDelta / baselineMean) * 100).toFixed(1));
  const zScore = Number((frpDelta / baselineStd).toFixed(2));

  let severity: AnomalySeverity = "NOMINAL";
  let anomalyTitle = "Nominal Thermal Profile";
  let anomalyDescription = `Observed radiant output (${currentFrp.toFixed(1)} MW) is within expected operating parameters (${baselineRangeLabel}).`;
  let isEarlyWarningAlert = false;

  if (zScore >= 3.0 || deviationPercent >= 80) {
    severity = "CRITICAL_SURGE";
    anomalyTitle = "Severe Thermal Surge / Abnormal Flaring Detected";
    anomalyDescription = `Radiant output exceeds nominal baseline by +${deviationPercent}% (Z-score +${zScore}). Indicates possible abnormal process upset, pressure relief flaring, or uncontained combustion.`;
    isEarlyWarningAlert = true;
  } else if (zScore >= 1.5 || deviationPercent >= 35) {
    severity = "MODERATE_DEVIATION";
    anomalyTitle = "Elevated Thermal Anomaly Above Baseline";
    anomalyDescription = `Combustion intensity is +${deviationPercent}% above normal operating baseline. Early warning: monitor subsequent passes for runaway flaring.`;
    isEarlyWarningAlert = true;
  }

  return {
    eventId: event.event_id,
    isIndustrial,
    baselineFrpMw: baselineMean,
    baselineRangeLabel,
    currentFrpMw: currentFrp,
    frpDeltaMw: Number(frpDelta.toFixed(1)),
    deviationPercent,
    zScore,
    severity,
    anomalyTitle,
    anomalyDescription,
    isEarlyWarningAlert,
  };
}
