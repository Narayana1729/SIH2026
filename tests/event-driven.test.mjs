import test from 'node:test';
import assert from 'node:assert/strict';

import { eventBus, SRI_EVENTS } from '../src/core/eventBus.js';
import { DisasterEventOrchestrator } from '../src/intelligence/eventOrchestrator.js';

test('Event-Driven Architecture: eventBus Pub/Sub & History', () => {
  eventBus.clear();
  let receivedPayload = null;

  const unsubscribe = eventBus.on(SRI_EVENTS.HAZARD_SELECTED, (payload) => {
    receivedPayload = payload;
  });

  eventBus.emit(SRI_EVENTS.HAZARD_SELECTED, { id: 'test-fire-01', hazard_type: 'WILDFIRE', severity: 'CRITICAL' });

  assert.ok(receivedPayload !== null);
  assert.equal(receivedPayload.id, 'test-fire-01');
  assert.equal(receivedPayload.hazard_type, 'WILDFIRE');

  // Verify history buffer
  const history = eventBus.getHistory(SRI_EVENTS.HAZARD_SELECTED);
  assert.equal(history.length, 1);
  assert.equal(history[0].payload.id, 'test-fire-01');

  // Test unsubscribe
  unsubscribe();
  receivedPayload = null;
  eventBus.emit(SRI_EVENTS.HAZARD_SELECTED, { id: 'test-fire-02' });
  assert.equal(receivedPayload, null, 'Unsubscribed listener should not receive events');
});

test('Event-Driven Architecture: Multi-Hazard Escalation Event Triggering', () => {
  eventBus.clear();
  const orchestrator = new DisasterEventOrchestrator(null, null);

  let escalatedAlert = null;
  eventBus.on(SRI_EVENTS.ALERT_ESCALATED, (alert) => {
    escalatedAlert = alert;
  });

  // Simulate incoming hazards with a wildfire 6km from an industrial facility
  const mockHazards = [
    {
      id: 'wildfire-jamnagar-01',
      hazard_type: 'WILDFIRE',
      location: { latitude: 22.4800, longitude: 70.0600 },
    },
    {
      id: 'facility-jamnagar-01',
      title: 'Jamnagar Petrochemical Complex',
      hazard_type: 'INDUSTRIAL_HAZMAT',
      location: { latitude: 22.4707, longitude: 70.0577, district: 'Jamnagar' },
    },
  ];

  orchestrator._correlateMultiHazards(mockHazards);

  assert.ok(escalatedAlert !== null, 'Should trigger ALERT_ESCALATED when fire is within 15km of plant');
  assert.equal(escalatedAlert.severity, 'CRITICAL');
  assert.ok(escalatedAlert.title.includes('Jamnagar Petrochemical Complex'));
  assert.ok(escalatedAlert.subtitle.includes('HazMat protocol triggered'));

  orchestrator.destroy();
});
