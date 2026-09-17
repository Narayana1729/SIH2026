/**
 * @module server/services/alertLogStore
 * @description Production Server-Side JSONL Alert Persistence & Audit Trail Store.
 *
 * Implements an append-only JSONL audit log for thermal alerts:
 *  - Persistent storage at `data/alerts/alerts.jsonl`
 *  - Event deduplication by `event_id`
 *  - Stateful operator lifecycle tracking: CREATED -> ACKNOWLEDGED -> RESOLVED | DISMISSED
 *  - Complete chronological audit trail export
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AlertLogStore {
  constructor(options = {}) {
    this.logDir = options.logDir || path.resolve(__dirname, '../../data/alerts');
    this.logFilePath = options.logFilePath || path.join(this.logDir, 'alerts.jsonl');
    
    // In-memory index of current alert states: alertId -> Alert Object
    this.alerts = new Map();
    // Index for fast deduplication: event_id -> alertId
    this.eventIndex = new Map();
    // In-memory audit trail array
    this.auditTrail = [];

    this._ensureStorage();
    this._replayLog();
  }

  _ensureStorage() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      if (!fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, '', 'utf8');
      }
    } catch (err) {
      console.warn('[AlertLogStore] Warning ensuring storage directory:', err.message);
    }
  }

  /**
   * Replays the JSONL audit log on startup to reconstruct state.
   */
  _replayLog() {
    try {
      if (!fs.existsSync(this.logFilePath)) return;
      const content = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line.trim());
          this.auditTrail.push(entry);
          this._applyAuditEntry(entry);
        } catch {}
      }
    } catch (err) {
      console.warn('[AlertLogStore] Error replaying log:', err.message);
    }
  }

  _applyAuditEntry(entry) {
    const { alertId, action, event_id, timestamp, note, payload } = entry;
    if (!alertId) return;

    if (action === 'CREATED') {
      const alert = {
        alertId,
        event_id: event_id || alertId,
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
        title: payload?.title || `Alert ${alertId}`,
        severity: payload?.severity || 'HIGH',
        priority: payload?.priority || 2,
        location: payload?.location || null,
        incident_type: payload?.incident_type || 'THERMAL_ANOMALY',
        details: payload?.details || {},
      };
      this.alerts.set(alertId, alert);
      if (alert.event_id) {
        this.eventIndex.set(alert.event_id, alertId);
      }
    } else {
      const existing = this.alerts.get(alertId);
      if (existing) {
        existing.status = action;
        existing.updatedAt = timestamp;
        if (note) existing.lastNote = note;
      }
    }
  }

  /**
   * Appends an audit entry to the persistent JSONL file.
   */
  _appendEntry(entry) {
    this.auditTrail.push(entry);
    this._applyAuditEntry(entry);
    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n', 'utf8');
    } catch (err) {
      console.error('[AlertLogStore] Failed to write to JSONL log:', err.message);
    }
  }

  /**
   * Ingests or updates an alert with strict event_id deduplication.
   * If the event_id exists, does not create duplicate; updates last seen timestamp.
   *
   * @param {object} incident - Incoming incident or alert payload
   * @returns {{ alert: object, isNew: boolean }}
   */
  ingestAlert(incident = {}) {
    const eventId = incident.event_id || incident.id || null;
    
    // Deduplication check
    if (eventId && this.eventIndex.has(eventId)) {
      const existingId = this.eventIndex.get(eventId);
      const existingAlert = this.alerts.get(existingId);
      if (existingAlert) {
        existingAlert.updatedAt = new Date().toISOString();
        return { alert: existingAlert, isNew: false };
      }
    }

    const alertId = incident.alertId || incident.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const entry = {
      timestamp: now,
      alertId,
      event_id: eventId || alertId,
      action: 'CREATED',
      note: incident.note || null,
      operator: incident.operator || 'SYSTEM_INGESTION',
      payload: {
        title: incident.title || 'Thermal Anomaly Alert',
        severity: incident.severity || 'HIGH',
        priority: incident.priority || 2,
        location: incident.location || null,
        incident_type: incident.incident_type || 'THERMAL_ANOMALY',
        details: incident.details || incident,
      },
    };

    this._appendEntry(entry);
    return { alert: this.alerts.get(alertId), isNew: true };
  }

  /**
   * Record operator action against an alert (ACKNOWLEDGED, RESOLVED, DISMISSED).
   */
  recordAction(alertId, action, note = null, operator = 'OPERATOR_1') {
    const validActions = ['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid alert action '${action}'. Must be one of: ${validActions.join(', ')}`);
    }

    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert '${alertId}' not found.`);
    }

    const entry = {
      timestamp: new Date().toISOString(),
      alertId,
      event_id: alert.event_id,
      action,
      note: note || null,
      operator,
    };

    this._appendEntry(entry);
    return this.alerts.get(alertId);
  }

  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter((a) => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');
  }

  getAllAlerts() {
    return Array.from(this.alerts.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getAuditTrail(alertId = null) {
    if (alertId) {
      return this.auditTrail.filter((e) => e.alertId === alertId);
    }
    return [...this.auditTrail];
  }
}

export const defaultAlertLogStore = new AlertLogStore();
