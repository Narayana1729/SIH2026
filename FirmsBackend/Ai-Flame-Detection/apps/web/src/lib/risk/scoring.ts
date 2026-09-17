import type { ThermalEvent } from "../../types/event.ts";
import type { RiskAssessment, RiskFactor, RiskLevel, ActionRecommendation } from "../../types/risk.ts";
import type { IncidentEvolution } from "../../types/evolution.ts";
import type { PopulationExposureResult } from "../../types/exposure.ts";
import type { AtmosphericDispersionResult } from "../../types/dispersion.ts";

/**
 * Derives operational action recommendation based on score and severity level.
 */
export function deriveActionRecommendation(
  level: RiskLevel,
  score: number,
  event: ThermalEvent,
  evolution?: IncidentEvolution | null,
  exposure?: PopulationExposureResult | null
): ActionRecommendation {
  if (level === "INDETERMINATE") {
    return {
      protocolCode: "REVIEW-MANDATE-00",
      headline: "Operator Review Required (Automated Decision Abstained)",
      responseWindowMinutes: 45,
      primaryAction: "Operator manual review required to verify ground-truth context before tactical dispatch.",
      secondaryActions: [
        "Inspect high-resolution optical imagery or local industrial registries.",
        "Check adjacent sensors for multi-pass confirmation.",
        "Do not issue public alarms until facility identity is confirmed.",
      ],
      agencyRoles: ["Duty Operations Intelligence Analyst", "State Remote Sensing Node"],
      notificationUrgency: "STANDARD",
    };
  }

  if (level === "CRITICAL") {
    const settlementCount = exposure?.settlements?.length || 1;
    const popExposed = exposure?.exposedPopulationEstimate?.toLocaleString() || "localized";
    return {
      protocolCode: "DIS-TAC-LEVEL-1",
      headline: "Immediate Tactical Incident Command Dispatch",
      responseWindowMinutes: 15,
      primaryAction: `Dispatch district hazardous industrial emergency response units for physical on-site verification within 15 minutes.`,
      secondaryActions: [
        `Issue precautionary air quality advisory for ${settlementCount} downwind settlements (~${popExposed} residents).`,
        "Initiate ambient particulate and toxic VOC telemetry monitoring in downwind plume corridor.",
        "Alert District Collector and Chief Fire Officer for hazardous material containment standby.",
        "Establish 1.5 km safety cordon around active emitter.",
      ],
      agencyRoles: [
        "District Disaster Management Authority (DDMA)",
        "State Pollution Control Board (SPCB)",
        "Hazardous Materials Emergency Response Team",
      ],
      notificationUrgency: "IMMEDIATE",
    };
  }

  if (level === "HIGH") {
    return {
      protocolCode: "DIS-TAC-LEVEL-2",
      headline: "Drone Reconnaissance & Facility HSE Verification",
      responseWindowMinutes: 30,
      primaryAction: "Request plant telemetry confirmation and deploy automated sensor/drone verification within 30 minutes.",
      secondaryActions: [
        "Notify plant Health, Safety & Environment (HSE) manager to confirm operational flaring status.",
        "Monitor satellite pass trajectory for next orbital overpass confirmation.",
        "Verify flare stack containment valves and scrubber telemetry.",
      ],
      agencyRoles: [
        "Industrial Area Fire Authority",
        "Plant Safety Operations Command",
        "District Environmental Inspectorate",
      ],
      notificationUrgency: "HIGH",
    };
  }

  if (level === "MEDIUM") {
    return {
      protocolCode: "DIS-TAC-LEVEL-3",
      headline: "Automated Watch Registry & Baseline Tracking",
      responseWindowMinutes: 60,
      primaryAction: "Log in operational watch registry; verify recurrence on subsequent satellite overpass.",
      secondaryActions: [
        "Compare current emission with historical 30-day flaring baseline.",
        "Flag for human operator review if combustion persists beyond 4 hours.",
      ],
      agencyRoles: ["Regional Remote Sensing Watch", "Duty Operations Officer"],
      notificationUrgency: "STANDARD",
    };
  }

  // LOW
  return {
    protocolCode: "DIS-TAC-LEVEL-4",
    headline: "Routine Automated Telemetry Ingestion",
    responseWindowMinutes: 120,
    primaryAction: "Automated catalog logging; no active emergency response required.",
    secondaryActions: ["Maintain baseline automated orbital surveillance."],
    agencyRoles: ["Automated Ingestion Pipeline"],
    notificationUrgency: "MONITOR",
  };
}

/**
 * Computes an explainable, deterministic operational risk assessment for a canonical thermal event.
 *
 * Grounded 4-factor operational heuristic (Sum to 100):
 * Factor 1: Thermal Radiative Intensity (FRP) [0 - 40 points]
 * Factor 2: Temporal Persistence & Recurrence [5 - 25 points]
 * Factor 3: Infrastructure Proximity [10 - 25 points]
 * Factor 4: Sensor Cluster Density [2 - 10 points]
 */
export function calculateOperationalRisk(
  event: ThermalEvent,
  evolution?: IncidentEvolution | null,
  exposure?: PopulationExposureResult | null
): RiskAssessment {
  const disclaimer =
    "Derived frontend operational heuristic · Distinct from ML model classification confidence";

  // 1. Safe Handling for Unknown / Abstained / Insufficient Information
  if (event.classification === "UNKNOWN" && event.uncertainty_state === "REVIEW_REQUIRED") {
    const actionRecommendation = deriveActionRecommendation("INDETERMINATE", 0, event, evolution, exposure);
    return {
      score: 0,
      level: "INDETERMINATE",
      isIndeterminate: true,
      indeterminateReason: "Awaiting ML Context / Classification",
      summary: "Operational risk is indeterminate pending contextual facility attribution and human review.",
      actionRecommendation,
      factors: [
        {
          name: "Classification State",
          points: 0,
          maxPoints: 25,
          description: "Awaiting contextual intelligence (UNKNOWN classification)",
        },
        {
          name: "Uncertainty Gate",
          points: 0,
          maxPoints: 25,
          description: "Flagged as REVIEW_REQUIRED (insufficient historical baseline)",
        },
      ],
      disclaimer,
    };
  }

  const factors: RiskFactor[] = [];

  // Factor 1: Thermal Radiative Intensity (FRP) [0 - 40 points]
  const frp = typeof event.frp_mw === "number" && !isNaN(event.frp_mw) ? event.frp_mw : 0;
  let frpPoints = 5;
  let frpDesc = "Minor thermal signature (< 15 MW)";

  if (frp >= 250) {
    frpPoints = 40;
    frpDesc = `Extreme thermal radiative output (${frp.toFixed(1)} MW ≥ 250 MW)`;
  } else if (frp >= 100) {
    frpPoints = 30;
    frpDesc = `High combustion intensity (${frp.toFixed(1)} MW ≥ 100 MW)`;
  } else if (frp >= 40) {
    frpPoints = 20;
    frpDesc = `Moderate thermal output (${frp.toFixed(1)} MW ≥ 40 MW)`;
  } else if (frp >= 15) {
    frpPoints = 10;
    frpDesc = `Low-moderate anomaly (${frp.toFixed(1)} MW ≥ 15 MW)`;
  }

  factors.push({
    name: "Thermal Intensity",
    points: frpPoints,
    maxPoints: 40,
    description: frpDesc,
  });

  // Factor 2: Persistence & Temporal Recurrence [5 - 25 points]
  const isPersistent = Boolean(event.is_persistent);
  const persistencePoints = isPersistent ? 25 : 5;
  const persistenceDesc = isPersistent
    ? "Confirmed multi-day recurring thermal activity"
    : "Transient single-cycle anomaly";

  factors.push({
    name: "Temporal Persistence",
    points: persistencePoints,
    maxPoints: 25,
    description: persistenceDesc,
  });

  // Factor 3: Industrial Infrastructure Context [10 - 25 points]
  let industrialPoints = 10;
  let industrialDesc = "Non-industrial / natural background area";

  if (event.classification === "INDUSTRIAL") {
    industrialPoints = 25;
    industrialDesc = "Active petrochemical, refinery, or heavy industrial facility";
  } else if (event.classification === "UNKNOWN") {
    industrialPoints = 10;
    industrialDesc = "Unconfirmed infrastructure proximity";
  }

  factors.push({
    name: "Infrastructure Context",
    points: industrialPoints,
    maxPoints: 25,
    description: industrialDesc,
  });

  // Factor 4: Multi-Sensor Observation Cluster [2 - 10 points]
  const count =
    typeof event.detection_count === "number" && !isNaN(event.detection_count)
      ? event.detection_count
      : 1;
  let clusterPoints = 2;
  let clusterDesc = "Single satellite pass detection";

  if (count >= 5) {
    clusterPoints = 10;
    clusterDesc = `Dense multi-satellite observation cluster (${count} detections)`;
  } else if (count >= 2) {
    clusterPoints = 6;
    clusterDesc = `Confirmed multi-sensor detection (${count} detections)`;
  }

  factors.push({
    name: "Cluster Density",
    points: clusterPoints,
    maxPoints: 10,
    description: clusterDesc,
  });

  // Sum & Clamp Score [0 - 100]
  const rawScore = frpPoints + persistencePoints + industrialPoints + clusterPoints;
  const score = Math.min(100, Math.max(0, rawScore));

  // Determine Severity Level
  let level: RiskLevel = "LOW";
  let summary = "Low operational severity thermal anomaly.";

  if (score >= 80) {
    level = "CRITICAL";
    summary = "Critical operational severity: high-intensity persistent industrial emission.";
  } else if (score >= 60) {
    level = "HIGH";
    summary = "High operational severity: significant combustion or confirmed industrial flare.";
  } else if (score >= 35) {
    level = "MEDIUM";
    summary = "Moderate operational severity: monitor for persistence or escalation.";
  }

  const actionRecommendation = deriveActionRecommendation(level, score, event, evolution, exposure);

  return {
    score,
    level,
    factors,
    isIndeterminate: false,
    summary,
    actionRecommendation,
    disclaimer,
  };
}

/**
 * Advanced 6-factor operational risk assessment incorporating trajectory, dispersion, and exposure.
 */
export function calculateComprehensiveOperationalRisk(
  event: ThermalEvent,
  evolution?: IncidentEvolution | null,
  exposure?: PopulationExposureResult | null,
  dispersion?: AtmosphericDispersionResult | null
): RiskAssessment {
  const base = calculateOperationalRisk(event, evolution, exposure);
  if (base.isIndeterminate) return base;

  // Additional factor: Incident Trajectory (0 - 20 pts)
  let trajectoryPoints = 10;
  let trajectoryDesc = "Stable baseline trajectory";
  if (evolution) {
    if (evolution.trajectory === "ESCALATING") {
      trajectoryPoints = 20;
      trajectoryDesc = `Escalating trajectory (+${evolution.frpChangePercent}% FRP growth)`;
    } else if (evolution.trajectory === "DECAYING") {
      trajectoryPoints = 2;
      trajectoryDesc = `Decaying trajectory (${evolution.frpChangePercent}% cooling)`;
    }
  }

  // Additional factor: Exposure & Dispersion (0 - 20 pts)
  let exposurePoints = 5;
  let exposureDesc = "Localized exposure footprint";
  if (exposure && exposure.exposedPopulationEstimate >= 5000) {
    exposurePoints = 20;
    exposureDesc = `High population exposure (~${exposure.exposedPopulationEstimate.toLocaleString()} residents)`;
  } else if (exposure && exposure.exposedPopulationEstimate >= 1000) {
    exposurePoints = 12;
    exposureDesc = `Moderate population exposure (~${exposure.exposedPopulationEstimate.toLocaleString()} residents)`;
  }

  const factors: RiskFactor[] = [
    ...base.factors,
    { name: "Incident Trajectory", points: trajectoryPoints, maxPoints: 20, description: trajectoryDesc },
    { name: "Population & Plume Exposure", points: exposurePoints, maxPoints: 20, description: exposureDesc },
  ];

  // Normalized score
  const totalPoints = factors.reduce((sum, f) => sum + f.points, 0);
  const maxPoints = factors.reduce((sum, f) => sum + f.maxPoints, 0);
  const score = Math.round((totalPoints / maxPoints) * 100);

  let level: RiskLevel = "LOW";
  if (score >= 75) level = "CRITICAL";
  else if (score >= 55) level = "HIGH";
  else if (score >= 35) level = "MEDIUM";

  const actionRecommendation = deriveActionRecommendation(level, score, event, evolution, exposure);

  return {
    score,
    level,
    factors,
    isIndeterminate: false,
    summary: base.summary,
    actionRecommendation,
    disclaimer: base.disclaimer,
  };
}

/**
 * Returns color classes and badges for a given risk level.
 */
export function getRiskLevelStyles(level: RiskLevel): {
  bg: string;
  text: string;
  border: string;
  badgeVariant: "error" | "warning" | "industrial" | "neutral" | "success";
  label: string;
} {
  switch (level) {
    case "CRITICAL":
      return {
        bg: "bg-state-error/15",
        text: "text-state-error",
        border: "border-state-error/40",
        badgeVariant: "error",
        label: "CRITICAL",
      };
    case "HIGH":
      return {
        bg: "bg-accent/15",
        text: "text-accent",
        border: "border-accent/40",
        badgeVariant: "industrial",
        label: "HIGH",
      };
    case "MEDIUM":
      return {
        bg: "bg-state-warning/15",
        text: "text-state-warning",
        border: "border-state-warning/40",
        badgeVariant: "warning",
        label: "MEDIUM",
      };
    case "LOW":
      return {
        bg: "bg-state-success/15",
        text: "text-state-success",
        border: "border-state-success/40",
        badgeVariant: "success",
        label: "LOW",
      };
    case "INDETERMINATE":
    default:
      return {
        bg: "bg-accent-cyan/15",
        text: "text-accent-cyan",
        border: "border-accent-cyan/40",
        badgeVariant: "neutral",
        label: "INDETERMINATE",
      };
  }
}
