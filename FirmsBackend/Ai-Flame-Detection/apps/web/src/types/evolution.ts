/**
 * Canonical types for PYROSAT Incident Evolution Engine.
 * Computes multi-observation trajectory, growth dynamics, and propagation vectors.
 */

export type IncidentTrajectory = "ESCALATING" | "STABLE" | "DECAYING" | "INSUFFICIENT_HISTORY";
export type TemperatureTrend = "HEATING" | "STEADY" | "COOLING";
export type ConfidenceTrend = "INCREASING" | "STABLE" | "DECREASING" | "FLUCTUATING";

export interface MovementVector {
  bearingDeg: number;
  directionLabel: string;
  speedKmH: number;
  totalDistanceKm: number;
}

export interface ObservationSnapshot {
  timestamp: string;
  source: string;
  frpMw: number;
  confidence: string;
  latitude: number;
  longitude: number;
}

export interface IncidentEvolution {
  eventId: string;
  trajectory: IncidentTrajectory;
  trajectoryConfidence: number; // 0.0 - 1.0
  observationCount: number;
  persistenceDurationHours: number;
  
  // Rate of change metrics
  initialFrpMw: number;
  latestFrpMw: number;
  frpGrowthRateMwPerHr: number;
  frpChangePercent: number;
  
  areaGrowthKm2PerHr: number;
  estimatedFootprintKm2: number;
  
  temperatureTrend: TemperatureTrend;
  temperatureDeltaK: number;
  estimatedRadiantTempK: number;
  
  movementVector: MovementVector;
  confidenceTrend: ConfidenceTrend;
  
  observations: ObservationSnapshot[];
  summary: string;
  riskEscalationDeltaPoints: number; // Suggested adjustment to base risk score
}
