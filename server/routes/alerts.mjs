/**
 * @module server/routes/alerts
 * @description API routes for persistent thermal anomaly alerts and JSONL audit trail.
 */

import { defaultAlertLogStore } from '../services/alertLogStore.mjs';
import { sendJson, sendError } from '../middleware/security.mjs';

export async function handleAlertsRoute(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  // 1. GET /api/v1/alerts -> List alerts
  if (pathname === '/api/v1/alerts' && method === 'GET') {
    const statusFilter = url.searchParams.get('status');
    const all = defaultAlertLogStore.getAllAlerts();
    const alerts = statusFilter ? all.filter((a) => a.status === statusFilter.toUpperCase()) : all;
    return sendJson(res, 200, {
      status: 'ok',
      count: alerts.length,
      alerts,
    }, {}, req);
  }

  // 2. GET /api/v1/alerts/audit-trail -> Complete chronological audit log
  if (pathname === '/api/v1/alerts/audit-trail' && method === 'GET') {
    const alertId = url.searchParams.get('alertId');
    const trail = defaultAlertLogStore.getAuditTrail(alertId);
    return sendJson(res, 200, {
      status: 'ok',
      count: trail.length,
      audit_trail: trail,
    }, {}, req);
  }

  // 3. POST /api/v1/alerts/ingest -> Ingest incident with deduplication
  if (pathname === '/api/v1/alerts/ingest' && method === 'POST') {
    let bodyRaw = '';
    for await (const chunk of req) bodyRaw += chunk;
    let payload = {};
    try {
      payload = JSON.parse(bodyRaw || '{}');
    } catch {
      return sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON', [], req);
    }

    const result = defaultAlertLogStore.ingestAlert(payload);
    return sendJson(res, result.isNew ? 201 : 200, {
      status: 'ok',
      isNew: result.isNew,
      alert: result.alert,
    }, {}, req);
  }

  // 4. POST /api/v1/alerts/action -> Operator action (ACKNOWLEDGED, RESOLVED, DISMISSED)
  if (pathname === '/api/v1/alerts/action' && method === 'POST') {
    let bodyRaw = '';
    for await (const chunk of req) bodyRaw += chunk;
    let payload = {};
    try {
      payload = JSON.parse(bodyRaw || '{}');
    } catch {
      return sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON', [], req);
    }

    const { alertId, action, note, operator } = payload;
    if (!alertId || !action) {
      return sendError(res, 422, 'MISSING_FIELDS', 'alertId and action are required', [], req);
    }

    try {
      const updated = defaultAlertLogStore.recordAction(alertId, action.toUpperCase(), note, operator);
      return sendJson(res, 200, {
        status: 'ok',
        alert: updated,
      }, {}, req);
    } catch (err) {
      return sendError(res, 400, 'ACTION_FAILED', err.message, [], req);
    }
  }

  return sendError(res, 404, 'NOT_FOUND', `Alert endpoint '${pathname}' not found`, [], req);
}
