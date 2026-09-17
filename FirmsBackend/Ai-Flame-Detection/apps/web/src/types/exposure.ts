/**
 * Canonical types for Population & Vulnerable Infrastructure Exposure modeling.
 */

export interface AffectedSettlement {
  name: string;
  distanceKm: number;
  bearingDeg: number;
  etaMinutes: number;
  population: number;
}

export interface VulnerableFacility {
  name: string;
  type: "school" | "hospital" | "industrial_plant" | "transit_corridor" | "residential";
  distanceKm: number;
  bearingDeg: number;
}

export interface PopulationExposureResult {
  eventId: string;
  evaluatedAt: string;
  exposedPopulationEstimate: number;
  settlements: AffectedSettlement[];
  vulnerableFacilities: VulnerableFacility[];
  plumeAreaKm2: number;
  airQualityImpactLevel: "LOW" | "MODERATE" | "UNHEALTHY" | "HAZARDOUS";
  criticalFacilitiesCount: number;
  summary: string;
  effectiveReleaseHeightM?: number;
  downwindTouchdownDistanceM?: number;
  fumigationRisk?: boolean;
}
