import type { ThermalEvent, TimelineObservation } from "@/types/event";
import type {
  IncidentEvolution,
  IncidentTrajectory,
  MovementVector,
  ObservationSnapshot,
  TemperatureTrend,
  ConfidenceTrend,
} from "@/types/evolution";

/**
 * Calculates compass direction label from bearing in degrees (0 - 360).
 */
export function getCompassDirection(bearingDeg: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(((bearingDeg % 360) + 360) % 360 / 22.5) % 16;
  return directions[index];
}

/**
 * Calculates Haversine distance in kilometers between two lat/lon coordinates.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates initial bearing in degrees from point 1 to point 2.
 */
export function calculateBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

/**
 * Planck pyrometry effective temperature approximation in Kelvin based on FRP and pixel geometry.
 */
export function estimateEffectiveTemperatureK(frpMw: number, isIndustrial: boolean): number {
  if (frpMw <= 0) return 600;
  // Industrial flares concentrate high heat (>1000K) in small combustion zones
  // Wildfires/stubble are larger area cooler combustion (650K - 900K)
  const base = isIndustrial ? 1100 : 700;
  const scale = isIndustrial ? 60 : 35;
  return Math.round(base + Math.min(600, Math.log10(Math.max(1, frpMw)) * scale * 3.5));
}

/**
 * Analyzes the chronological progression of an incident across satellite overpasses.
 */
export function computeIncidentEvolution(
  event: ThermalEvent,
  rawTimeline?: TimelineObservation[] | null
): IncidentEvolution {
  const isIndustrial = event.classification === "INDUSTRIAL";
  const defaultTemp = estimateEffectiveTemperatureK(event.frp_mw, isIndustrial);

  // Normalize and sort observations
  const observations: ObservationSnapshot[] = (rawTimeline && rawTimeline.length > 0)
    ? [...rawTimeline]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((obs) => ({
          timestamp: obs.timestamp,
          source: obs.source || "VIIRS",
          frpMw: typeof obs.frp_mw === "number" && !isNaN(obs.frp_mw) ? obs.frp_mw : event.frp_mw,
          confidence: obs.confidence || "nominal",
          latitude: obs.latitude || event.latitude,
          longitude: obs.longitude || event.longitude,
        }))
    : [
        {
          timestamp: event.start_time,
          source: event.satellite_instrument || "VIIRS",
          frpMw: event.frp_mw,
          confidence: event.confidence >= 0.8 ? "high" : "nominal",
          latitude: event.latitude,
          longitude: event.longitude,
        },
      ];

  const obsCount = observations.length;

  if (obsCount < 2) {
    const singleObs = observations[0];
    return {
      eventId: event.event_id,
      trajectory: "INSUFFICIENT_HISTORY",
      trajectoryConfidence: 0.5,
      observationCount: 1,
      persistenceDurationHours: 0,
      initialFrpMw: singleObs.frpMw,
      latestFrpMw: singleObs.frpMw,
      frpGrowthRateMwPerHr: 0,
      frpChangePercent: 0,
      areaGrowthKm2PerHr: 0,
      estimatedFootprintKm2: Math.max(0.1, Number((singleObs.frpMw * 0.005).toFixed(2))),
      temperatureTrend: "STEADY",
      temperatureDeltaK: 0,
      estimatedRadiantTempK: defaultTemp,
      movementVector: {
        bearingDeg: 0,
        directionLabel: "Stationary",
        speedKmH: 0,
        totalDistanceKm: 0,
      },
      confidenceTrend: "STABLE",
      observations,
      summary: "Single satellite overpass. Trajectory indeterminate awaiting next observation cycle.",
      riskEscalationDeltaPoints: 0,
    };
  }

  const first = observations[0];
  const last = observations[observations.length - 1];

  const startTimeMs = new Date(first.timestamp).getTime();
  const endTimeMs = new Date(last.timestamp).getTime();
  const durationHours = Math.max(0.25, (endTimeMs - startTimeMs) / (1000 * 60 * 60));

  // FRP dynamics
  const initialFrp = Math.max(0.1, first.frpMw);
  const latestFrp = Math.max(0.1, last.frpMw);
  const frpDelta = latestFrp - initialFrp;
  const frpChangePercent = Number(((frpDelta / initialFrp) * 100).toFixed(1));
  const frpGrowthRateMwPerHr = Number((frpDelta / durationHours).toFixed(2));

  // Spatial movement & area dynamics
  const totalDistanceKm = haversineDistanceKm(
    first.latitude,
    first.longitude,
    last.latitude,
    last.longitude
  );
  const speedKmH = Number((totalDistanceKm / durationHours).toFixed(2));
  const bearingDeg = Math.round(
    calculateBearingDeg(first.latitude, first.longitude, last.latitude, last.longitude)
  );
  const directionLabel = totalDistanceKm < 0.15 ? "Stationary (Localized)" : getCompassDirection(bearingDeg);

  const initialFootprint = Math.max(0.1, initialFrp * 0.006);
  const latestFootprint = Math.max(0.1, latestFrp * 0.006);
  const areaGrowthKm2PerHr = Number(((latestFootprint - initialFootprint) / durationHours).toFixed(3));

  // Temperature dynamics
  const tempFirst = estimateEffectiveTemperatureK(initialFrp, isIndustrial);
  const tempLast = estimateEffectiveTemperatureK(latestFrp, isIndustrial);
  const temperatureDeltaK = tempLast - tempFirst;
  let temperatureTrend: TemperatureTrend = "STEADY";
  if (temperatureDeltaK > 25) temperatureTrend = "HEATING";
  else if (temperatureDeltaK < -25) temperatureTrend = "COOLING";

  // Confidence stability
  let confidenceTrend: ConfidenceTrend = "STABLE";
  const confScores = observations.map((o) => (o.confidence === "high" ? 3 : o.confidence === "nominal" ? 2 : 1));
  const confDelta = confScores[confScores.length - 1] - confScores[0];
  if (confDelta > 0) confidenceTrend = "INCREASING";
  else if (confDelta < 0) confidenceTrend = "DECREASING";

  // Trajectory classification
  let trajectory: IncidentTrajectory = "STABLE";
  let summary = "";
  let riskEscalationDeltaPoints = 0;

  if (frpChangePercent >= 20 || frpGrowthRateMwPerHr >= 15 || areaGrowthKm2PerHr > 0.05 || (speedKmH > 0.5 && !isIndustrial)) {
    trajectory = "ESCALATING";
    riskEscalationDeltaPoints = 20;
    summary = `Incident escalating: FRP increased by +${frpChangePercent}% (+${frpGrowthRateMwPerHr} MW/h) across ${obsCount} overpasses with thermal expansion toward ${directionLabel}.`;
  } else if (frpChangePercent <= -20 || frpGrowthRateMwPerHr <= -15 || temperatureTrend === "COOLING") {
    trajectory = "DECAYING";
    riskEscalationDeltaPoints = 0;
    summary = `Incident decaying: Combustion intensity decreased by ${frpChangePercent}% (${frpGrowthRateMwPerHr} MW/h) over ${durationHours.toFixed(1)}h with cooling radiant signature.`;
  } else {
    trajectory = "STABLE";
    riskEscalationDeltaPoints = 10;
    summary = `Incident stable: Sustained combustion at ~${latestFrp.toFixed(1)} MW with consistent footprint over ${durationHours.toFixed(1)}h across ${obsCount} observations.`;
  }

  return {
    eventId: event.event_id,
    trajectory,
    trajectoryConfidence: Math.min(0.98, 0.65 + obsCount * 0.07),
    observationCount: obsCount,
    persistenceDurationHours: Number(durationHours.toFixed(1)),
    initialFrpMw: initialFrp,
    latestFrpMw: latestFrp,
    frpGrowthRateMwPerHr,
    frpChangePercent,
    areaGrowthKm2PerHr,
    estimatedFootprintKm2: Number(latestFootprint.toFixed(2)),
    temperatureTrend,
    temperatureDeltaK,
    estimatedRadiantTempK: tempLast,
    movementVector: {
      bearingDeg,
      directionLabel,
      speedKmH,
      totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    },
    confidenceTrend,
    observations,
    summary,
    riskEscalationDeltaPoints,
  };
}
