import type { ThermalEvent, TimelineObservation } from "../../types/event.ts";
import { haversineDistanceKm } from "../evolution/evolution.ts";

export type SensorConfirmationStatus =
  | "MULTI_SENSOR_CONFIRMED"
  | "TEMPORAL_REPEAT_CONFIRMED"
  | "SINGLE_SENSOR_UNVERIFIED"
  | "POTENTIAL_FALSE_ALARM";

export interface SatelliteCrossValidationResult {
  eventId: string;
  agreementScorePercent: number; // 0 - 100%
  confirmationStatus: SensorConfirmationStatus;
  participatingSensors: string[];
  sensorCount: number;
  spatialCoherenceKm: number; // Max distance between sensor centroids
  temporalCoherenceHours: number;
  isMultiSensor: boolean;
  isFalsePositiveSuspect: boolean;
  validationSummary: string;
  reliabilityLevel: "HIGH" | "MODERATE" | "LOW" | "UNVERIFIED";
}

/**
 * Validates satellite observations across independent sensors (VIIRS SNPP/NOAA20/21, MODIS Terra/Aqua)
 * to prevent single-sensor false positives and compute sensor agreement.
 */
export function validateSatelliteObservations(
  event: ThermalEvent,
  rawTimeline?: TimelineObservation[] | null
): SatelliteCrossValidationResult {
  const observations = (rawTimeline && rawTimeline.length > 0)
    ? rawTimeline
    : [
        {
          timestamp: event.start_time,
          source: event.satellite_instrument || "VIIRS",
          frp_mw: event.frp_mw,
          confidence: event.confidence >= 0.8 ? "high" : "nominal",
          latitude: event.latitude,
          longitude: event.longitude,
          detection_id: event.event_id,
        },
      ];

  const uniqueSensors = Array.from(new Set(observations.map((o) => o.source || "VIIRS")));
  const sensorCount = uniqueSensors.length;
  const observationCount = observations.length;

  // Compute spatial coherence (max distance between pairwise observations)
  let maxSpatialDistanceKm = 0;
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const dist = haversineDistanceKm(
        observations[i].latitude,
        observations[i].longitude,
        observations[j].latitude,
        observations[j].longitude
      );
      if (dist > maxSpatialDistanceKm) {
        maxSpatialDistanceKm = dist;
      }
    }
  }

  // Compute temporal coherence (time span)
  const timestamps = observations.map((o) => new Date(o.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const durationHours = (maxTime - minTime) / (1000 * 60 * 60);

  // Cross-sensor agreement formula:
  // Base 60% if high confidence, +20% if multiple distinct sensors, +15% if recurring in time, -20% if spatial drift > 2km
  let agreementScore = 60;
  if (event.confidence >= 0.85) agreementScore += 10;
  if (sensorCount >= 2) agreementScore += 18; // VIIRS + MODIS multi-constellation agreement
  if (observationCount >= 3) agreementScore += 12;
  else if (observationCount >= 2) agreementScore += 7;

  if (maxSpatialDistanceKm > 2.5) {
    agreementScore -= 20; // Spatial dispersion discrepancy
  } else if (maxSpatialDistanceKm <= 1.0 && observationCount >= 2) {
    agreementScore += 5; // Excellent colocation
  }

  const agreementScorePercent = Math.max(25, Math.min(99, agreementScore));

  // Determine confirmation status
  let confirmationStatus: SensorConfirmationStatus = "SINGLE_SENSOR_UNVERIFIED";
  let isFalsePositiveSuspect = false;
  let reliabilityLevel: "HIGH" | "MODERATE" | "LOW" | "UNVERIFIED" = "MODERATE";

  if (sensorCount >= 2 && maxSpatialDistanceKm <= 1.8) {
    confirmationStatus = "MULTI_SENSOR_CONFIRMED";
    reliabilityLevel = "HIGH";
  } else if (observationCount >= 2 && maxSpatialDistanceKm <= 2.0) {
    confirmationStatus = "TEMPORAL_REPEAT_CONFIRMED";
    reliabilityLevel = "HIGH";
  } else if (observationCount === 1) {
    if (event.confidence < 0.60 && event.frp_mw < 15 && event.classification === "UNKNOWN") {
      confirmationStatus = "POTENTIAL_FALSE_ALARM";
      isFalsePositiveSuspect = true;
      reliabilityLevel = "LOW";
    } else {
      confirmationStatus = "SINGLE_SENSOR_UNVERIFIED";
      reliabilityLevel = "UNVERIFIED";
    }
  }

  // Human-readable summary
  let validationSummary = "";
  if (confirmationStatus === "MULTI_SENSOR_CONFIRMED") {
    validationSummary = `Confirmed across ${sensorCount} satellite constellations (${uniqueSensors.join(", ")}): ${agreementScorePercent}% multi-sensor spatial agreement within ${maxSpatialDistanceKm.toFixed(2)} km.`;
  } else if (confirmationStatus === "TEMPORAL_REPEAT_CONFIRMED") {
    validationSummary = `Confirmed via ${observationCount} consecutive satellite passes over ${durationHours.toFixed(1)}h: ${agreementScorePercent}% temporal consistency.`;
  } else if (confirmationStatus === "POTENTIAL_FALSE_ALARM") {
    validationSummary = `Suspected transient artifact or solar glint: single isolated pass with low confidence (${(event.confidence * 100).toFixed(0)}%) and unverified spatial persistence.`;
  } else {
    validationSummary = `Single-sensor observation (${uniqueSensors[0]}): awaiting secondary constellation overpass for multi-satellite confirmation.`;
  }

  return {
    eventId: event.event_id,
    agreementScorePercent,
    confirmationStatus,
    participatingSensors: uniqueSensors,
    sensorCount,
    spatialCoherenceKm: Number(maxSpatialDistanceKm.toFixed(2)),
    temporalCoherenceHours: Number(durationHours.toFixed(1)),
    isMultiSensor: sensorCount >= 2,
    isFalsePositiveSuspect,
    validationSummary,
    reliabilityLevel,
  };
}
