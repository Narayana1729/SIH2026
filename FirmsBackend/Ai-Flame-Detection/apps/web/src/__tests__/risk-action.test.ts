import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateOperationalRisk } from "../lib/risk/scoring.ts";
import { calculatePopulationExposure } from "../lib/exposure/exposure.ts";
import { computeIncidentEvolution } from "../lib/evolution/evolution.ts";
import type { ThermalEvent, TimelineObservation } from "../types/event.ts";

describe("Operational Risk -> Action Engine & Exposure Suite", () => {
  const criticalEvent: ThermalEvent = {
    event_id: "evt-crit-001",
    latitude: 22.476,
    longitude: 70.077,
    location_name: "Jamnagar Petrochemical Complex, Gujarat",
    phenomenon: "FLARE",
    classification: "INDUSTRIAL",
    confidence: 0.95,
    uncertainty_state: "CONFIDENT",
    frp_mw: 280.0,
    detection_count: 5,
    start_time: "2026-09-05T06:00:00Z",
    end_time: "2026-09-05T12:00:00Z",
    is_persistent: true,
  };

  it("calculates high exposure metrics for heavy industrial thermal emitter", () => {
    const exposure = calculatePopulationExposure(criticalEvent);
    assert.ok(exposure.exposedPopulationEstimate > 1000, "Exposed population should be significant");
    assert.ok(exposure.settlements.length >= 1, "Should identify downwind settlements");
    assert.ok(exposure.vulnerableFacilities.length >= 1, "Should identify facilities within plume reach");
    assert.equal(exposure.airQualityImpactLevel, "HAZARDOUS");
  });

  it("produces CRITICAL operational risk and immediate action recommendation for escalating event", () => {
    const timeline: TimelineObservation[] = [
      { timestamp: "2026-09-05T06:00:00Z", detection_id: "d1", latitude: 22.476, longitude: 70.077, source: "VIIRS", frp_mw: 100, confidence: "high" },
      { timestamp: "2026-09-05T10:00:00Z", detection_id: "d2", latitude: 22.480, longitude: 70.080, source: "MODIS", frp_mw: 280, confidence: "high" },
    ];
    const evolution = computeIncidentEvolution(criticalEvent, timeline);
    const exposure = calculatePopulationExposure(criticalEvent);
    const risk = calculateOperationalRisk(criticalEvent, evolution, exposure);

    assert.equal(risk.level, "CRITICAL");
    assert.ok(risk.score >= 75, "Score should be >= 75");
    assert.equal(risk.actionRecommendation.notificationUrgency, "IMMEDIATE");
    assert.equal(risk.actionRecommendation.responseWindowMinutes, 15);
    assert.ok(risk.actionRecommendation.headline.includes("Dispatch"));
  });

  it("abstains with INDETERMINATE and operator review protocol for UNKNOWN events", () => {
    const unknownEvent: ThermalEvent = {
      ...criticalEvent,
      event_id: "evt-unk-001",
      classification: "UNKNOWN",
      uncertainty_state: "REVIEW_REQUIRED",
      confidence: 0.40,
    };
    const risk = calculateOperationalRisk(unknownEvent);
    assert.equal(risk.level, "INDETERMINATE");
    assert.equal(risk.score, 0);
    assert.equal(risk.isIndeterminate, true);
    assert.equal(risk.actionRecommendation.protocolCode, "REVIEW-MANDATE-00");
    assert.ok(risk.actionRecommendation.headline.includes("Review Required"));
  });
});
