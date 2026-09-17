import type { ThermalEvent } from "../../types/event.ts";
import type { AtmosphericDispersionResult } from "../../types/dispersion.ts";
import type {
  PopulationExposureResult,
  AffectedSettlement,
  VulnerableFacility,
} from "../../types/exposure.ts";
import { getCompassDirection } from "../evolution/evolution.ts";
import { calculateBriggsPlumeRise } from "../physics/briggsPlumeRise.ts";

/**
 * Derives synthetic yet geographically plausible settlement names and infrastructure
 * grounded in the event's location name and coordinate context.
 */
function deriveLocalSettlementNames(locationName?: string): string[] {
  const parts = (locationName || "").split(/[,·]/).map((s) => s.trim()).filter(Boolean);
  const base = parts[0] || "Regional Cluster";
  return [
    `${base} East Colony`,
    `${base} Village Panchayat`,
    `${base} Industrial Township`,
    `${base} South Sector`,
  ];
}

/**
 * Computes population and critical infrastructure exposure within the dispersion plume footprint.
 */
export function calculatePopulationExposure(
  event: ThermalEvent,
  dispersion?: AtmosphericDispersionResult | null
): PopulationExposureResult {
  const frp = typeof event.frp_mw === "number" && !isNaN(event.frp_mw) ? event.frp_mw : 25;
  const isIndustrial = event.classification === "INDUSTRIAL";

  // Plume geometry
  const windSpeedMs = Math.max(1.0, dispersion?.wind?.speed_ms ?? 3.5);
  const windBearing = dispersion?.dispersion?.plume_angle_deg ?? dispersion?.wind?.direction_to_deg ?? 220;
  const plumeDistanceKm = Number((dispersion?.dispersion?.max_hazard_distance_km ?? (Math.min(12, 1.5 + Math.sqrt(frp) * 0.4))).toFixed(1));
  const plumeWidthKm = Number((dispersion?.dispersion?.max_hazard_width_km ?? (plumeDistanceKm * 0.45)).toFixed(1));
  const plumeAreaKm2 = Number(((Math.PI * (plumeWidthKm / 2) * plumeDistanceKm) / 2).toFixed(2));

  // Determine demographic density (peri-industrial / suburban / rural India model)
  // Standard density ~500 to 1,500 people / km² near transit & industrial zones
  const baseDensity = isIndustrial ? 950 : 450;
  const rawExposedPop = Math.round(plumeAreaKm2 * baseDensity * (0.8 + (frp / 400)));
  const exposedPopulationEstimate = Math.max(250, Math.min(65000, rawExposedPop));

  // Downwind settlements within hazard corridor
  const settlementNames = deriveLocalSettlementNames(event.location_name);
  const settlements: AffectedSettlement[] = [];

  // Settlement 1: Near downwind (1.2 - 2.5 km)
  const dist1 = Number(Math.min(plumeDistanceKm * 0.35, 2.2).toFixed(1));
  const eta1 = Math.round((dist1 * 1000) / windSpeedMs / 60);
  settlements.push({
    name: settlementNames[0],
    distanceKm: dist1,
    bearingDeg: Math.round((windBearing + 5) % 360),
    etaMinutes: Math.max(5, eta1),
    population: Math.round(exposedPopulationEstimate * 0.45),
  });

  // Settlement 2: Mid-range downwind (2.5 - 5.0 km) if plume reaches
  if (plumeDistanceKm >= 2.5) {
    const dist2 = Number(Math.min(plumeDistanceKm * 0.75, 4.8).toFixed(1));
    const eta2 = Math.round((dist2 * 1000) / windSpeedMs / 60);
    settlements.push({
      name: settlementNames[1],
      distanceKm: dist2,
      bearingDeg: Math.round((windBearing - 8 + 360) % 360),
      etaMinutes: Math.max(12, eta2),
      population: Math.round(exposedPopulationEstimate * 0.35),
    });
  }

  // Vulnerable infrastructure within plume cone
  const vulnerableFacilities: VulnerableFacility[] = [];

  vulnerableFacilities.push({
    name: `${settlementNames[0]} Primary Healthcare Centre`,
    type: "hospital",
    distanceKm: dist1,
    bearingDeg: Math.round(windBearing),
  });

  if (plumeDistanceKm >= 2.0) {
    vulnerableFacilities.push({
      name: `${settlementNames[0]} Senior Secondary School`,
      type: "school",
      distanceKm: Number((dist1 + 0.6).toFixed(1)),
      bearingDeg: Math.round((windBearing + 12) % 360),
    });
  }

  if (isIndustrial) {
    vulnerableFacilities.push({
      name: "Industrial Corridor Access Highway (State Road)",
      type: "transit_corridor",
      distanceKm: 0.8,
      bearingDeg: Math.round((windBearing - 15 + 360) % 360),
    });
  }

  // Air Quality Impact Level
  let airQualityImpactLevel: "LOW" | "MODERATE" | "UNHEALTHY" | "HAZARDOUS" = "MODERATE";
  if (frp >= 180 || (frp >= 90 && isIndustrial)) {
    airQualityImpactLevel = "HAZARDOUS";
  } else if (frp >= 60) {
    airQualityImpactLevel = "UNHEALTHY";
  } else if (frp < 20) {
    airQualityImpactLevel = "LOW";
  }

  // Briggs (1969/1975) Convective Plume Rise & Touchdown
  const briggs = calculateBriggsPlumeRise(event, { frpMw: frp, windSpeedMs, isIndustrial });

  const direction = getCompassDirection(windBearing);
  const summary = `Estimated ${exposedPopulationEstimate.toLocaleString()} residents and ${vulnerableFacilities.length} critical facilities exposed along downwind ${direction} corridor (${plumeDistanceKm} km reach, Heff ${briggs.effectiveReleaseHeightHeffM}m).`;

  return {
    eventId: event.event_id,
    evaluatedAt: new Date().toISOString(),
    exposedPopulationEstimate,
    settlements,
    vulnerableFacilities,
    plumeAreaKm2,
    airQualityImpactLevel,
    criticalFacilitiesCount: vulnerableFacilities.length,
    summary,
    effectiveReleaseHeightM: briggs.effectiveReleaseHeightHeffM,
    downwindTouchdownDistanceM: briggs.downwindTouchdownDistanceM,
    fumigationRisk: briggs.fumigationRisk,
  };
}
