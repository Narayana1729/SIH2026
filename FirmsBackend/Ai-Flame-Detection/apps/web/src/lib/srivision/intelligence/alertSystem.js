/**
 * @module intelligence/alertSystem
 * @description Priority Incident Alert System for sriVision.
 * Ingests multi-source correlated incidents, ranks by severity and recency, and outputs operator advisories.
 */

export class AlertSystem {
  constructor() {
    this.alerts = [];
    this.maxAlerts = 100;
  }

  /**
   * Clears and updates the active alert list from fresh multi-source events.
   * @param {Array<object>} incidents
   * @returns {Array<object>} Sorted alerts
   */
  updateAlerts(incidents = []) {
    const alerts = [];

    for (const inc of incidents) {
      if (!inc || !inc.severity) continue;

      let priorityOrder = 4; // LOW
      if (inc.severity === 'CRITICAL') priorityOrder = 1;
      else if (inc.severity === 'HIGH') priorityOrder = 2;
      else if (inc.severity === 'MODERATE') priorityOrder = 3;

      alerts.push({
        id: inc.id || inc.event_id || `alert-${Math.random().toString(36).slice(2, 9)}`,
        title: this.formatAlertTitle(inc),
        incident_type: inc.incident_type,
        severity: inc.severity,
        priority: priorityOrder,
        location: inc.location,
        place: inc.place || inc.zone_name || 'Coordinates indicated',
        details: inc,
        recommendation: inc.operator_action || 'Operator verification recommended.',
        timestamp: inc.timestamp || new Date().toISOString(),
      });
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

  getActiveAlerts() {
    return this.alerts;
  }

  getCriticalAlerts() {
    return this.alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH');
  }
}

export const defaultAlertSystem = new AlertSystem();
