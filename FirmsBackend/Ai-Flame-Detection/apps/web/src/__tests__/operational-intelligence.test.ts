import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSatelliteObservations } from "../lib/validation/cross-sensor.ts";
import { generateCounterfactualExplanation } from "../lib/xai/counterfactual.ts";
import { computeThermalAnomalyProfile } from "../lib/anomaly/anomaly.ts";
import { saveOperatorFeedback, getModelGovernanceStats } from "../lib/feedback/feedbackStore.ts";
import type { ThermalEvent, TimelineObservation } from "../types/event.ts";

describe("Operational Intelligence & Validation Suite", () => {
  const mockIndustrialEvent: ThermalEvent = {
    event_id: "EVT-TEST-OP-01",
    latitude: 22.47,
    longitude: 70.07,
    phenomenon: "FLARE",
    classification: "INDUSTRIAL",
    confidence: 0.94,
    uncertainty_state: "CONFIDENT",
    frp_mw: 240.0,
    detection_count: 3,
    start_time: "2026-09-05T08:00:00Z",
    end_time: "2026-09-05T12:00:00Z",
    is_persistent: true,
  };

  it("computes high multi-sensor agreement for cross-satellite observations", () => {
    const timeline: TimelineObservation[] = [
      { timestamp: "2026-09-05T08:00:00Z", detection_id: "d1", latitude: 22.471, longitude: 70.071, source: "VIIRS_SNPP", frp_mw: 210, confidence: "high" },
      { timestamp: "2026-09-05T10:30:00Z", detection_id: "d2", latitude: 22.473, longitude: 70.072, source: "MODIS_AQUA", frp_mw: 240, confidence: "high" },
    ];
    const validation = validateSatelliteObservations(mockIndustrialEvent, timeline);

    assert.equal(validation.isMultiSensor, true);
    assert.equal(validation.sensorCount, 2);
    assert.ok(validation.agreementScorePercent >= 85, "Agreement score should be >= 85%");
    assert.equal(validation.confirmationStatus, "MULTI_SENSOR_CONFIRMED");
    assert.equal(validation.reliabilityLevel, "HIGH");
  });

  it("flags single isolated low-confidence pass as unverified / potential false alarm", () => {
    const suspectEvent: ThermalEvent = {
      ...mockIndustrialEvent,
      event_id: "EVT-TEST-SUSPECT",
      classification: "UNKNOWN",
      confidence: 0.45,
      frp_mw: 8.0,
      detection_count: 1,
    };
    const validation = validateSatelliteObservations(suspectEvent, []);

    assert.equal(validation.isMultiSensor, false);
    assert.equal(validation.confirmationStatus, "POTENTIAL_FALSE_ALARM");
    assert.equal(validation.isFalsePositiveSuspect, true);
    assert.equal(validation.reliabilityLevel, "LOW");
  });

  it("generates actionable counterfactual explanation for industrial classification", () => {
    const cf = generateCounterfactualExplanation(mockIndustrialEvent);

    assert.equal(cf.originalClassification.includes("INDUSTRIAL"), true);
    assert.equal(cf.counterfactualClassification.includes("NON_INDUSTRIAL"), true);
    assert.ok(cf.conditions.length >= 2);
    assert.ok(cf.conditions.some((c) => c.featureName.includes("Infrastructure Proximity")));
  });

  it("detects thermal surge and early-warning baseline deviation", () => {
    const anomaly = computeThermalAnomalyProfile(mockIndustrialEvent);

    assert.equal(anomaly.isIndustrial, true);
    assert.ok(anomaly.deviationPercent > 80, "Deviation should exceed 80% for 240 MW vs 95 MW nominal");
    assert.equal(anomaly.severity, "CRITICAL_SURGE");
    assert.equal(anomaly.isEarlyWarningAlert, true);
    assert.ok(anomaly.anomalyTitle.includes("Surge"));
  });

  it("records operator feedback and updates model governance statistics", () => {
    const feedback = saveOperatorFeedback("EVT-TEST-OP-01", "VERIFIED_INDUSTRIAL", "Confirmed refinery flare stack");
    assert.equal(feedback.eventId, "EVT-TEST-OP-01");
    assert.equal(feedback.verifiedLabel, "VERIFIED_INDUSTRIAL");

    const stats = getModelGovernanceStats();
    assert.ok(stats.totalVerifiedIncidentsCount >= 1842);
    assert.equal(stats.modelVersion, "v4.1.2-prod");
  });
});
