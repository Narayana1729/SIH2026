/**
 * Operational Risk & Severity Intelligence Contracts
 *
 * CRITICAL SCIENTIFIC DISTINCTION:
 * - Model Confidence: "How confident is the ML model in its predicted classification?"
 * - Operational Risk: "How operationally severe / urgent is this thermal event?"
 *
 * Explicit 6-factor formulation:
 * Intensity + Persistence + Trajectory + Proximity + Dispersion + Exposure -> Risk (0-100) -> Action
 */

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INDETERMINATE";

export interface RiskFactor {
  name: string;
  points: number;
  maxPoints: number;
  description: string;
}

export interface ActionRecommendation {
  protocolCode: string;
  headline: string;
  responseWindowMinutes: number;
  primaryAction: string;
  secondaryActions: string[];
  agencyRoles: string[];
  notificationUrgency: "IMMEDIATE" | "HIGH" | "STANDARD" | "MONITOR";
}

export interface RiskAssessment {
  score: number; // Clamped 0-100 (or 0 when indeterminate)
  level: RiskLevel;
  factors: RiskFactor[];
  isIndeterminate: boolean;
  indeterminateReason?: string;
  summary: string;
  actionRecommendation: ActionRecommendation;
  disclaimer: string;
}
