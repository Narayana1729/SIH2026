import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeIncidentEvolution } from "../lib/evolution/evolution.ts";
import type { ThermalEvent, TimelineObservation } from "../types/event.ts";

describe("Incident Evolution Engine Suite", () => {
  const mockBaseEvent: ThermalEvent = {
    event_id: "evt-test-001",
    latitude: 19.076,
    longitude: 72.877,
    phenomenon: "FLARE",
    classification: "INDUSTRIAL",
    confidence: 0.92,
    uncertainty_state: "CONFIDENT",
    frp_mw: 120.0,
    detection_count: 3,
    start_time: "2026-09-05T06:00:00Z",
    end_time: "2026-09-05T12:00:00Z",
    is_persistent: true,
  };

  it("handles single observation gracefully as INSUFFICIENT_HISTORY", () => {
    const evo = computeIncidentEvolution(mockBaseEvent, []);
    assert.equal(evo.trajectory, "INSUFFICIENT_HISTORY");
    assert.equal(evo.observationCount, 1);
    assert.equal(evo.frpGrowthRateMwPerHr, 0);
  });

  it("detects ESCALATING trajectory when FRP surges significantly across overpasses", () => {
    const timeline: TimelineObservation[] = [
      {
        timestamp: "2026-09-05T06:00:00Z",
        detection_id: "det-1",
        latitude: 19.076,
        longitude: 72.877,
        source: "VIIRS_SNPP",
        frp_mw: 60.0,
        confidence: "nominal",
      },
      {
        timestamp: "2026-09-05T08:30:00Z",
        detection_id: "det-2",
        latitude: 19.080,
        longitude: 72.880,
        source: "MODIS_TERRA",
        frp_mw: 110.0,
        confidence: "high",
      },
      {
        timestamp: "2026-09-05T11:00:00Z",
        detection_id: "det-3",
        latitude: 19.085,
        longitude: 72.885,
        source: "VIIRS_NOAA20",
        frp_mw: 180.0,
        confidence: "high",
      },
    ];

    const evo = computeIncidentEvolution(mockBaseEvent, timeline);
    assert.equal(evo.trajectory, "ESCALATING");
    assert.ok(evo.frpGrowthRateMwPerHr > 15, "Growth rate should exceed 15 MW/hr");
    assert.ok(evo.frpChangePercent >= 100, "FRP should more than double (+100% or more)");
    assert.equal(evo.observationCount, 3);
    assert.equal(evo.temperatureTrend, "HEATING");
    assert.ok(evo.riskEscalationDeltaPoints >= 20);
  });

  it("detects DECAYING trajectory when combustion diminishes across overpasses", () => {
    const timeline: TimelineObservation[] = [
      {
        timestamp: "2026-09-05T06:00:00Z",
        detection_id: "det-1",
        latitude: 19.076,
        longitude: 72.877,
        source: "VIIRS",
        frp_mw: 200.0,
        confidence: "high",
      },
      {
        timestamp: "2026-09-05T09:00:00Z",
        detection_id: "det-2",
        latitude: 19.076,
        longitude: 72.877,
        source: "MODIS",
        frp_mw: 80.0,
        confidence: "nominal",
      },
    ];

    const evo = computeIncidentEvolution(mockBaseEvent, timeline);
    assert.equal(evo.trajectory, "DECAYING");
    assert.ok(evo.frpChangePercent < -30, "FRP change should be negative");
    assert.equal(evo.temperatureTrend, "COOLING");
    assert.equal(evo.riskEscalationDeltaPoints, 0);
  });

  it("detects STABLE trajectory for continuous stationary industrial flare", () => {
    const timeline: TimelineObservation[] = [
      {
        timestamp: "2026-09-05T06:00:00Z",
        detection_id: "det-1",
        latitude: 19.076,
        longitude: 72.877,
        source: "VIIRS",
        frp_mw: 100.0,
        confidence: "high",
      },
      {
        timestamp: "2026-09-05T10:00:00Z",
        detection_id: "det-2",
        latitude: 19.076,
        longitude: 72.877,
        source: "MODIS",
        frp_mw: 105.0,
        confidence: "high",
      },
    ];

    const evo = computeIncidentEvolution(mockBaseEvent, timeline);
    assert.equal(evo.trajectory, "STABLE");
    assert.ok(Math.abs(evo.frpChangePercent) < 15, "FRP should remain steady within 15%");
    assert.ok(evo.movementVector.speedKmH < 0.1, "Should be virtually stationary");
    assert.equal(evo.riskEscalationDeltaPoints, 10);
  });
});
