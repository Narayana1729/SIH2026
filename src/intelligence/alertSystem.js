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
    this.webhooks = [];
    this.telegramConfig = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || null,
      chatId: process.env.TELEGRAM_CHAT_ID || null,
      enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      minSeverity: 'HIGH',
    };
    this.dispatchHistory = [];
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

  /**
   * Register an external HTTP webhook for alert broadcasting.
   * @param {string} url - Target HTTP/HTTPS endpoint
   * @param {object} [options] - { secret, minSeverity: 'CRITICAL'|'HIGH'|'MODERATE'|'LOW' }
   */
  registerWebhook(url, options = {}) {
    if (!url || typeof url !== 'string') return false;
    const existing = this.webhooks.find((w) => w.url === url);
    if (existing) {
      existing.minSeverity = options.minSeverity || existing.minSeverity;
      existing.secret = options.secret || existing.secret;
      return true;
    }
    this.webhooks.push({
      url,
      secret: options.secret || null,
      minSeverity: options.minSeverity || 'HIGH',
      registeredAt: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Unregister an existing webhook URL.
   * @param {string} url
   */
  unregisterWebhook(url) {
    const prevLen = this.webhooks.length;
    this.webhooks = this.webhooks.filter((w) => w.url !== url);
    return this.webhooks.length < prevLen;
  }

  /**
   * Configure Telegram Bot dispatch credentials.
   * @param {object} config - { botToken, chatId, enabled, minSeverity }
   */
  configureTelegram({ botToken, chatId, enabled = true, minSeverity = 'HIGH' }) {
    this.telegramConfig = {
      botToken: botToken || this.telegramConfig.botToken,
      chatId: chatId || this.telegramConfig.chatId,
      enabled: Boolean(enabled && (botToken || this.telegramConfig.botToken) && (chatId || this.telegramConfig.chatId)),
      minSeverity: minSeverity || this.telegramConfig.minSeverity,
    };
    return this.telegramConfig;
  }

  /**
   * Format a high-impact Markdown string for Telegram broadcast.
   * @param {object} alert
   * @returns {string}
   */
  formatTelegramMessage(alert) {
    const sevEmoji = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'HIGH' ? '⚠️' : 'ℹ️';
    const lat = alert.location?.latitude ?? alert.details?.latitude ?? 'N/A';
    const lon = alert.location?.longitude ?? alert.details?.longitude ?? 'N/A';
    const frp = alert.details?.frp ?? alert.details?.intensity?.mean_frp_mw ?? 'N/A';

    return (
      `${sevEmoji} *PYROSAT DISASTER ALERT* ${sevEmoji}\n\n` +
      `*ID:* \`${alert.id}\`\n` +
      `*Type:* ${alert.incident_type}\n` +
      `*Severity:* ${alert.severity} (Priority ${alert.priority})\n` +
      `*Location:* ${alert.place}\n` +
      `*Coordinates:* \`${lat}, ${lon}\`\n` +
      `*Thermal Intensity:* ${frp} MW\n` +
      `*Action Required:* ${alert.recommendation}\n` +
      `*Timestamp:* ${alert.timestamp}`
    );
  }

  /**
   * Dispatch an alert to all registered webhooks and configured Telegram channel.
   * Runs asynchronously with non-blocking error handling and audit logging.
   *
   * @param {object} alert
   * @param {object} [options] - { dryRun: boolean, force: boolean }
   * @returns {Promise<object>} Dispatch summary report
   */
  async dispatchAlert(alert, options = {}) {
    if (!alert) return { dispatched: false, reason: 'NO_ALERT' };

    const dryRun = Boolean(options.dryRun || process.env.ALERT_DISPATCH_DRY_RUN === 'true');
    const severityRanks = { CRITICAL: 1, HIGH: 2, MODERATE: 3, LOW: 4 };
    const alertRank = severityRanks[alert.severity] || 4;

    const dispatchRecord = {
      timestamp: new Date().toISOString(),
      alertId: alert.id,
      severity: alert.severity,
      webhooksTriggered: 0,
      telegramSent: false,
      dryRun,
      errors: [],
    };

    // 1. Dispatch to Webhooks
    for (const hook of this.webhooks) {
      const minRank = severityRanks[hook.minSeverity] || 2;
      if (alertRank > minRank && !options.force) continue; // Alert not severe enough for this hook

      dispatchRecord.webhooksTriggered++;
      if (dryRun) continue;

      try {
        if (typeof globalThis.fetch === 'function') {
          const headers = { 'Content-Type': 'application/json', 'User-Agent': 'PyroSat-AlertDispatcher/1.0' };
          if (hook.secret) headers['X-PyroSat-Secret'] = hook.secret;

          // Non-blocking fetch with 4-second timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          await globalThis.fetch(hook.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ event: 'DISASTER_ALERT', alert, timestamp: new Date().toISOString() }),
            signal: controller.signal,
          }).catch((err) => {
            dispatchRecord.errors.push(`Webhook ${hook.url}: ${err.message}`);
          }).finally(() => clearTimeout(timeoutId));
        }
      } catch (err) {
        dispatchRecord.errors.push(`Webhook ${hook.url}: ${err.message}`);
      }
    }

    // 2. Dispatch to Telegram
    if (this.telegramConfig.enabled || dryRun) {
      const teleMinRank = severityRanks[this.telegramConfig.minSeverity] || 2;
      if (alertRank <= teleMinRank || options.force) {
        if (dryRun) {
          dispatchRecord.telegramSent = true;
        } else if (this.telegramConfig.botToken && this.telegramConfig.chatId && typeof globalThis.fetch === 'function') {
          try {
            const teleUrl = `https://api.telegram.org/bot${this.telegramConfig.botToken}/sendMessage`;
            const payload = {
              chat_id: this.telegramConfig.chatId,
              text: this.formatTelegramMessage(alert),
              parse_mode: 'Markdown',
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await globalThis.fetch(teleUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            }).catch((err) => {
              dispatchRecord.errors.push(`Telegram: ${err.message}`);
            }).finally(() => clearTimeout(timeoutId));

            if (res && res.ok) {
              dispatchRecord.telegramSent = true;
            }
          } catch (err) {
            dispatchRecord.errors.push(`Telegram: ${err.message}`);
          }
        }
      }
    }

    this.dispatchHistory.push(dispatchRecord);
    this._recordAuditEntry(alert.id, 'DISPATCHED', JSON.stringify({
      webhooks: dispatchRecord.webhooksTriggered,
      telegram: dispatchRecord.telegramSent,
      dryRun,
    }), 'ALERT_DISPATCHER');

    return dispatchRecord;
  }

  getDispatchHistory() {
    return [...this.dispatchHistory];
  }
}

export const defaultAlertSystem = new AlertSystem();
