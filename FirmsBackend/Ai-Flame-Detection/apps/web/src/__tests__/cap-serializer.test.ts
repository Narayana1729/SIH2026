import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCapAlert } from '../lib/protocols/capSerializer.ts';
import type { ThermalEvent } from '../types/event.ts';
import type { RiskAssessment } from '../types/risk.ts';
import type { IncidentEvolution } from '../types/evolution.ts';

function createMockEvent(overrides: Partial<ThermalEvent> = {}): ThermalEvent {
  return {
    event_id: 'evt-cap-test-99',
    latitude: 22.30,
    longitude: 73.18,
    phenomenon: 'FLARE',
    classification: 'INDUSTRIAL',
    confidence: 0.95,
    uncertainty_state: 'CONFIDENT',
    frp_mw: 85.0,
    detection_count: 6,
    start_time: new Date(Date.now() - 3600000).toISOString(),
    end_time: new Date().toISOString(),
    location_name: 'Vadodara Petrochemical Complex',
    ...overrides
  };
}

describe('OASIS Common Alerting Protocol (CAP v1.2 / NDMA) Serializer', () => {
  it('generates schema-compliant CAP v1.2 XML document', () => {
    const event = createMockEvent();
    const cap = generateCapAlert(event);

    assert.ok(cap.rawXml.includes('xmlns="urn:oasis:names:tc:emergency:cap:1.2"'));
    assert.ok(cap.rawXml.includes('<identifier>IN-NDMA-PYROSAT-'));
    assert.ok(cap.rawXml.includes('<sender>pyrosat-ops@sih26162.ndma.gov.in</sender>'));
    assert.ok(cap.rawXml.includes('<status>Actual</status>'));
    assert.ok(cap.rawXml.includes('<msgType>Alert</msgType>'));
    assert.ok(cap.rawXml.includes('<scope>Public</scope>'));
    assert.ok(cap.rawXml.includes('<circle>22.3000,73.1800'));
  });

  it('elevates severity to Extreme and urgency to Immediate for escalating or critical incidents', () => {
    const event = createMockEvent({ frp_mw: 140.0 });
    const mockRisk = {
      level: 'CRITICAL',
      score: 88,
      actionRecommendation: {
        protocolCode: 'DIS-TAC-LEVEL-4',
        headline: 'Critical Flare Surge',
        responseWindowMinutes: 15,
        primaryAction: 'Immediate multi-brigade deployment'
      }
    } as unknown as RiskAssessment;

    const mockEvolution = {
      state: 'ESCALATING',
      frpGrowthRateMwPerHr: 22.5
    } as unknown as IncidentEvolution;

    const cap = generateCapAlert(event, { risk: mockRisk, evolution: mockEvolution });

    assert.equal(cap.info.severity, 'Extreme');
    assert.equal(cap.info.urgency, 'Immediate');
    assert.ok(cap.rawXml.includes('<severity>Extreme</severity>'));
    assert.ok(cap.rawXml.includes('<urgency>Immediate</urgency>'));
    assert.ok(cap.rawXml.includes('<value>DIS-TAC-LEVEL-4</value>'));
  });

  it('escapes unsafe XML special characters properly', () => {
    const event = createMockEvent({
      location_name: 'Refinery Unit <A&B> "Dangerous" & Hot'
    });

    const cap = generateCapAlert(event);

    assert.ok(!cap.rawXml.includes('<A&B>'));
    assert.ok(cap.rawXml.includes('Refinery Unit &lt;A&amp;B&gt; &quot;Dangerous&quot; &amp; Hot'));
  });
});
