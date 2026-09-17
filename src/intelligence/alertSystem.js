/**
 * @module intelligence/alertSystem
 * @description Priority Incident Alert System for sriVision.
 * Ingests multi-source correlated incidents, ranks by severity and recency, and outputs operator advisories.
 */

export class AlertSystem {
  constructor() {
    this.alerts = [];
    this.maxAlerts = 100;
    this.auditLog = [];
    this.seenEventIds = new Set();
  }

  /**
   * Clears and updates the active alert list from fresh multi-source events with deduplication.
   * @param {Array<object>} incidents
   * @returns {Array<object>} Sorted alerts
   */
  updateAlerts(incidents = []) {
    const alerts = [...this.alerts]; // preserve existing status

    for (const inc of incidents) {
      if (!inc || !inc.severity) continue;

      const eventId = inc.id || inc.event_id || inc.incident_id || null;
      if (eventId && this.seenEventIds.has(eventId)) {
        // Update timestamp/details on existing alert rather than duplicating
        const existing = alerts.find((a) => a.event_id === eventId || a.id === eventId);
        if (existing) {
          existing.timestamp = inc.timestamp || new Date().toISOString();
          existing.details = inc;
          continue;
        }
      }

      let priorityOrder = 4; // LOW
      if (inc.severity === 'CRITICAL') priorityOrder = 1;
      else if (inc.severity === 'HIGH') priorityOrder = 2;
      else if (inc.severity === 'MODERATE') priorityOrder = 3;

      const alertId = eventId || `alert-${Math.random().toString(36).slice(2, 9)}`;
      if (eventId) this.seenEventIds.add(eventId);

      const newAlert = {
        id: alertId,
        event_id: eventId || alertId,
        title: this.formatAlertTitle(inc),
        incident_type: inc.incident_type || 'THERMAL_ANOMALY',
        severity: inc.severity,
        priority: priorityOrder,
        status: 'ACTIVE',
        location: inc.location,
        place: inc.place || inc.zone_name || 'Coordinates indicated',
        details: inc,
        recommendation: inc.operator_action || 'Operator verification recommended.',
        timestamp: inc.timestamp || new Date().toISOString(),
      };

      alerts.push(newAlert);
      this._recordAuditEntry(alertId, 'CREATED', null, 'SYSTEM_INGESTION');
    }

    // Sort: Priority 1 (CRITICAL) first, then by timestamp descending
    alerts.sort((a, b) => a.priority - b.priority || new Date(b.timestamp) - new Date(a.timestamp));
    this.alerts = alerts.slice(0, this.maxAlerts);
    return this.alerts;
  }

  formatAlertTitle(inc) {
    switch (inc.incident_type) {
      case 'WILDFIRE_ENVIRONMENTAL_RISK':
        return `Active Fire Risk (${inc.severity}): ${inc.potential_spread?.description || 'Thermal Anomaly'}`;
      case 'FOREST_DISTURBANCE_PATTERN':
        return `Canopy Disturbance (${inc.severity}): ${inc.zone_name || 'Forest Zone'}`;
      case 'SEISMIC_EVENT':
        return `M${inc.magnitude?.toFixed(1) || '?'} Earthquake (${inc.severity}) - ${inc.place || 'Seismic Event'}`;
      default:
        return `Environmental Alert: ${inc.incident_type || 'Incident'}`;
    }
  }

  _recordAuditEntry(alertId, action, note = null, operator = 'OPERATOR') {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      alertId,
      action,
      note,
      operator,
    });
  }

  acknowledgeAlert(alertId, note = null, operator = 'OPERATOR') {
    const alert = this.alerts.find((a) => a.id === alertId || a.event_id === alertId);
    if (!alert) return null;
    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedAt = new Date().toISOString();
    alert.lastNote = note;
    this._recordAuditEntry(alert.id, 'ACKNOWLEDGED', note, operator);
    return alert;
  }

  resolveAlert(alertId, note = null, operator = 'OPERATOR') {
    const alert = this.alerts.find((a) => a.id === alertId || a.event_id === alertId);
    if (!alert) return null;
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    alert.lastNote = note;
    this._recordAuditEntry(alert.id, 'RESOLVED', note, operator);
    return alert;
  }

  dismissAlert(alertId, note = null, operator = 'OPERATOR') {
    const alert = this.alerts.find((a) => a.id === alertId || a.event_id === alertId);
    if (!alert) return null;
    alert.status = 'DISMISSED';
    alert.dismissedAt = new Date().toISOString();
    alert.lastNote = note;
    this._recordAuditEntry(alert.id, 'DISMISSED', note, operator);
    return alert;
  }

  getActiveAlerts() {
    return this.alerts.filter((a) => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');
  }

  getCriticalAlerts() {
    return this.alerts.filter((a) => (a.severity === 'CRITICAL' || a.severity === 'HIGH') && a.status !== 'RESOLVED' && a.status !== 'DISMISSED');
  }

  getAuditTrail(alertId = null) {
    if (alertId) {
      return this.auditLog.filter((e) => e.alertId === alertId);
    }
    return [...this.auditLog];
  }
}

export const defaultAlertSystem = new AlertSystem();
