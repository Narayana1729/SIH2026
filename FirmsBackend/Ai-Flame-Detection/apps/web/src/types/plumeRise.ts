/**
 * Canonical types for Briggs (1969/1975) Convective Plume Rise & Fumigation Dynamics.
 * Models buoyant plume lift above physical emission source and downwind touchdown.
 */

export type AtmosphericStabilityClass = "A" | "B" | "C" | "D" | "E" | "F";

export interface BriggsPlumeRiseResult {
  physicalStackHeightM: number;
  convectiveHeatFluxFbM4s3: number;
  plumeRiseDeltaHM: number;
  effectiveReleaseHeightHeffM: number;
  stabilityClass: AtmosphericStabilityClass;
  stabilityLabel: string;
  downwindTouchdownDistanceM: number;
  maxGroundConcentrationFactorPpm: number;
  fumigationRisk: boolean;
  fumigationExplanation: string;
  isBuoyancyDominated: boolean;
  neutralTransitionDistanceXfM: number;
}
