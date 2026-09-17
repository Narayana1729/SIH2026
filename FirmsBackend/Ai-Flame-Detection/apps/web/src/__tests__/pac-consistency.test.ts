import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessPACConsistency } from '../lib/consistency/pacConsistency.ts';
import type { ThermalEvent } from '../types/event.ts';

function createMockEvent(overrides: Partial<ThermalEvent> = {}): ThermalEvent {
  return {
    event_id: 'test-event-pac',
    latitude: 22.45,
    longitude: 82.12,
    phenomenon: 'FLARE',
    classification: 'INDUSTRIAL',
    confidence: 0.92,
    uncertainty_state: 'CONFIDENT',
    frp_mw: 45.0,
    detection_count: 5,
    start_time: new Date(Date.now() - 3600000).toISOString(),
    end_time: new Date().toISOString(),
    ...overrides,
  };
}

describe('Tri-Focal Physics-AI-Context (PAC) Consistency Engine', () => {
  it('confirms AUTO_DISPATCH_AUTHORIZED when ML, Physics, and Context are mutually coherent', () => {
    const event = createMockEvent({
      classification: 'INDUSTRIAL',
      confidence: 0.94,
    });

    const result = assessPACConsistency(event, {
      pyrometry: {
        available: true,
        is_valid: true,
        emitter_temp_k: 1350,
        emitter_area_m2: 85,
        fractional_area_p: 0.0006,
        background_temp_k: 295,
        convergence_status: 'CONVERGED',
        phenomenon_tag: 'HIGH_TEMP_COMPACT_FLARE_STACK',
      },
      nearestAssetDistanceMeters: 220,
      assetName: 'Bhilai Steel Process Unit 4',
    });

    assert.equal(result.state, 'CONSISTENT');
    assert.equal(result.decisionRule, 'AUTO_DISPATCH_AUTHORIZED');
    assert.equal(result.failSafeTriggered, false);
    assert.ok(result.overallScore >= 75, `Expected high overall score, got ${result.overallScore}`);
    assert.equal(result.conflicts.length, 0);
    assert.equal(result.domainScores.ml.status, 'SUPPORTING');
    assert.equal(result.domainScores.physics.status, 'SUPPORTING');
    assert.equal(result.domainScores.context.status, 'SUPPORTING');
  });

  it('triggers FAIL-SAFE ABSTENTION (MANDATORY_HUMAN_REVIEW) when ML conflicts with Context (Industrial with no nearby asset)', () => {
    const event = createMockEvent({
      classification: 'INDUSTRIAL',
      confidence: 0.89,
    });

    const result = assessPACConsistency(event, {
      pyrometry: {
        available: true,
        is_valid: true,
        emitter_temp_k: 1100,
        emitter_area_m2: 120,
        fractional_area_p: 0.0008,
        background_temp_k: 295,
        convergence_status: 'CONVERGED',
        phenomenon_tag: 'HIGH_TEMP_COMPACT_FLARE_STACK',
      },
      nearestAssetDistanceMeters: 4500, // 4.5 km away! No plant nearby
      assetName: null,
    });

    assert.equal(result.state, 'DISCORDANT_CONFLICT');
    assert.equal(result.decisionRule, 'MANDATORY_HUMAN_REVIEW');
    assert.equal(result.failSafeTriggered, true);
    assert.ok(result.conflicts.length > 0, 'Must record cross-domain conflict');
    const mlContextConflict = result.conflicts.find(c => c.id === 'PAC-CONF-01');
    assert.ok(mlContextConflict, 'Expected PAC-CONF-01 conflict flag');
    assert.deepEqual(mlContextConflict?.domains, ['ML', 'CONTEXT']);
    assert.equal(result.domainScores.context.status, 'CONFLICTING');
  });

  it('triggers FAIL-SAFE ABSTENTION when ML predicts Wildfire inside an active industrial perimeter', () => {
    const event = createMockEvent({
      classification: 'NON_INDUSTRIAL',
      confidence: 0.85,
    });

    const result = assessPACConsistency(event, {
      pyrometry: {
        available: true,
        is_valid: true,
        emitter_temp_k: 820,
        emitter_area_m2: 450,
        fractional_area_p: 0.003,
        background_temp_k: 295,
        convergence_status: 'CONVERGED',
        phenomenon_tag: 'LARGE_AREA_INDUSTRIAL_OR_SURFACE_FIRE',
      },
      nearestAssetDistanceMeters: 180, // Inside facility fence line!
      assetName: 'Kallalo Petrochemical Complex',
    });

    assert.equal(result.state, 'DISCORDANT_CONFLICT');
    assert.equal(result.decisionRule, 'MANDATORY_HUMAN_REVIEW');
    assert.equal(result.failSafeTriggered, true);
    const perimeterConflict = result.conflicts.find(c => c.id === 'PAC-CONF-02');
    assert.ok(perimeterConflict, 'Expected PAC-CONF-02 (plant perimeter contradiction)');
    assert.equal(perimeterConflict?.severity, 'CRITICAL');
  });

  it('correctly approves open wildfire with isolated terrain and cooler physical combustion', () => {
    const event = createMockEvent({
      classification: 'NON_INDUSTRIAL',
      confidence: 0.90,
      frp_mw: 68.0,
    });

    const result = assessPACConsistency(event, {
      pyrometry: {
        available: true,
        is_valid: true,
        emitter_temp_k: 920,
        emitter_area_m2: 620,
        fractional_area_p: 0.004,
        background_temp_k: 295,
        convergence_status: 'CONVERGED',
        phenomenon_tag: 'LARGE_AREA_INDUSTRIAL_OR_SURFACE_FIRE',
      },
      nearestAssetDistanceMeters: 7500, // 7.5 km from any plant
      landCover: 'Dense Deciduous Forest',
    });

    assert.equal(result.state, 'CONSISTENT');
    assert.equal(result.decisionRule, 'AUTO_DISPATCH_AUTHORIZED');
    assert.equal(result.failSafeTriggered, false);
    assert.equal(result.conflicts.length, 0);
  });

  it('safely assigns MANDATORY_HUMAN_REVIEW to UNKNOWN / REVIEW_REQUIRED events', () => {
    const event = createMockEvent({
      classification: 'UNKNOWN',
      confidence: 0.42,
      uncertainty_state: 'REVIEW_REQUIRED',
    });

    const result = assessPACConsistency(event);

    assert.equal(result.state, 'DISCORDANT_CONFLICT');
    assert.equal(result.decisionRule, 'MANDATORY_HUMAN_REVIEW');
    assert.equal(result.failSafeTriggered, true);
  });
});
