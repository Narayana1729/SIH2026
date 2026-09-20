import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertSystem } from '../src/intelligence/alertSystem.js';

test('AlertSystem Webhook Dispatch: Registers, filters, and dispatches alerts in dry-run mode', async () => {
  const alertSys = new AlertSystem();

  // 1. Register Webhooks
  const registered1 = alertSys.registerWebhook('https://hooks.example.com/disaster-response', {
    minSeverity: 'HIGH',
    secret: 'test-secret-key',
  });
  const registered2 = alertSys.registerWebhook('https://hooks.example.com/critical-only', {
    minSeverity: 'CRITICAL',
  });

  assert.equal(registered1, true);
  assert.equal(registered2, true);
  assert.equal(alertSys.webhooks.length, 2);

  // 2. Configure Telegram (dry-run mode)
  alertSys.configureTelegram({
    botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    chatId: '@pyrosat_alerts_test',
    enabled: true,
    minSeverity: 'HIGH',
  });

  assert.equal(alertSys.telegramConfig.enabled, true);

  // 3. Test Telegram Message Formatting
  const sampleAlert = {
    id: 'ALT-VIZAG-99',
    incident_type: 'INDUSTRIAL_DISASTER',
    severity: 'CRITICAL',
    priority: 1,
    place: 'HPCL Vizag Refinery, Andhra Pradesh',
    location: { latitude: 17.688, longitude: 83.251 },
    details: { frp: 215.0 },
    recommendation: 'Enforce 800m cordon and deploy foam cannons.',
    timestamp: '2026-09-19T20:00:00.000Z',
  };

  const formattedMsg = alertSys.formatTelegramMessage(sampleAlert);
  assert.ok(formattedMsg.includes('PYROSAT DISASTER ALERT'));
  assert.ok(formattedMsg.includes('INDUSTRIAL_DISASTER'));
  assert.ok(formattedMsg.includes('HPCL Vizag Refinery'));
  assert.ok(formattedMsg.includes('215 MW'));

  // 4. Dispatch Alert in Dry-Run Mode
  const dispatch = await alertSys.dispatchAlert(sampleAlert, { dryRun: true });
  assert.equal(dispatch.alertId, 'ALT-VIZAG-99');
  assert.equal(dispatch.webhooksTriggered, 2); // Both hooks match CRITICAL
  assert.equal(dispatch.telegramSent, true);
  assert.equal(dispatch.dryRun, true);

  // Verify Audit Log
  const audit = alertSys.getAuditTrail('ALT-VIZAG-99');
  const dispatchAudit = audit.find(a => a.action === 'DISPATCHED');
  assert.ok(dispatchAudit);

  // 5. Test Severity Filtering (LOW severity alert shouldn't trigger HIGH/CRITICAL webhooks)
  const lowAlert = {
    id: 'ALT-LOW-01',
    incident_type: 'STUBBLE_BURNING',
    severity: 'LOW',
    priority: 4,
    place: 'Farmland',
    recommendation: 'Monitor',
    timestamp: '2026-09-19T20:05:00.000Z',
  };

  const lowDispatch = await alertSys.dispatchAlert(lowAlert, { dryRun: true });
  assert.equal(lowDispatch.webhooksTriggered, 0); // Neither hook triggers for LOW
  assert.equal(lowDispatch.telegramSent, false); // Telegram doesn't trigger for LOW

  // 6. Test Unregister Webhook
  const removed = alertSys.unregisterWebhook('https://hooks.example.com/critical-only');
  assert.equal(removed, true);
  assert.equal(alertSys.webhooks.length, 1);
});
