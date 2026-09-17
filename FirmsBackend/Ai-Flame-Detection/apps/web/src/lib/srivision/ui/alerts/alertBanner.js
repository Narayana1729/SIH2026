/**
 * @module ui/alerts/alertBanner
 * @description Priority Hazard Queue & Expandable Incident Banner for sriVision.
 * Avoids annoying scrolling tickers; provides a clear, actionable summary of active critical/high incidents.
 */

import * as Cesium from 'cesium';
import { SEVERITY_LEVELS } from '../../core/hazardContract.js';
import { HAZARD_ICONS } from '../../core/risk.js';
import { eventBus, SRI_EVENTS } from '../../core/eventBus.js';

export class AlertBanner {
  constructor(containerId = 'sri-alert-banner-container', viewer = null) {
    this.viewer = viewer;
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.incidents = [];
    this.isExpanded = false;
    this.onSelectHazard = null;

    this._injectStyles();
    this._setupEventSubscriptions();
    this.render();
  }

  _setupEventSubscriptions() {
    eventBus.on(SRI_EVENTS.ALERT_TRIGGERED, (incident) => {
      this.addIncident(incident);
    });

    eventBus.on(SRI_EVENTS.ALERT_ESCALATED, (incident) => {
      this.addIncident(incident);
      this.isExpanded = true; // Automatically expand on critical escalation
      this.render();
    });
  }

  addIncident(incident) {
    if (!incident || !incident.id) return;
    const existingIdx = this.incidents.findIndex((i) => i.id === incident.id);
    if (existingIdx >= 0) {
      this.incidents[existingIdx] = incident;
    } else {
      this.incidents.unshift(incident);
    }
    this.setIncidents(this.incidents);
  }

  setIncidents(incidents = []) {
    // Sort incidents by Severity (CRITICAL > HIGH > MODERATE) and recency
    const sevWeight = { [SEVERITY_LEVELS.CRITICAL]: 4, [SEVERITY_LEVELS.HIGH]: 3, [SEVERITY_LEVELS.MODERATE]: 2, [SEVERITY_LEVELS.LOW]: 1 };
    this.incidents = [...incidents].sort((a, b) => (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0));
    this.render();
  }

  render() {
    const criticalCount = this.incidents.filter((i) => i.severity === SEVERITY_LEVELS.CRITICAL).length;
    const highCount = this.incidents.filter((i) => i.severity === SEVERITY_LEVELS.HIGH).length;

    if (this.incidents.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    const itemsHtml = this.incidents.slice(0, 8).map((inc) => {
      const icon = HAZARD_ICONS[inc.hazard_type] || '🚨';
      return `
        <div class="sri-alert-item ${inc.severity === SEVERITY_LEVELS.CRITICAL ? 'crit' : 'high'}" data-hazard-id="${inc.id}">
          <div class="sri-alert-item-left">
            <span class="sri-alert-item-icon">${icon}</span>
            <div class="sri-alert-item-text">
              <div class="sri-alert-item-title">${inc.title}</div>
              <div class="sri-alert-item-sub">${inc.subtitle || inc.location?.locality || ''}</div>
            </div>
          </div>
          <button class="sri-fly-btn" data-lat="${inc.location.latitude}" data-lon="${inc.location.longitude}">
            FLY TO 📍
          </button>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="sri-alert-card ${this.isExpanded ? 'expanded' : ''}">
        <div class="sri-alert-bar" id="sri-alert-toggle">
          <div class="sri-alert-pill">
            <span class="sri-alert-dot"></span>
            <strong>${criticalCount} CRITICAL</strong> · ${highCount} WARNINGS ACTIVE
          </div>
          <button class="sri-alert-view-btn">${this.isExpanded ? 'COLLAPSE ▲' : 'VIEW INCIDENTS ▼'}</button>
        </div>
        ${this.isExpanded ? `<div class="sri-alert-drawer">${itemsHtml}</div>` : ''}
      </div>
    `;

    document.getElementById('sri-alert-toggle')?.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      this.render();
    });

    this.container.querySelectorAll('.sri-fly-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lat = Number(btn.getAttribute('data-lat'));
        const lon = Number(btn.getAttribute('data-lon'));
        if (this.viewer && !isNaN(lat) && !isNaN(lon)) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, 25000),
            duration: 1.8,
          });
        }
      });
    });

    this.container.querySelectorAll('.sri-alert-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-hazard-id');
        const match = this.incidents.find((i) => i.id === id);
        if (match && this.onSelectHazard) {
          this.onSelectHazard(match);
        }
      });
    });
  }

  _injectStyles() {
    if (document.getElementById('sri-alert-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-alert-styles';
    style.textContent = `
      #sri-alert-banner-container {
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 998;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        pointer-events: auto;
      }
      .sri-alert-card {
        background: var(--glass-bg, rgba(12, 12, 20, 0.88));
        border: 1px solid rgba(255, 51, 68, 0.35);
        border-radius: var(--btn-radius, 10px);
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 51, 68, 0.1) inset;
        color: var(--text-primary, #e8eaed);
        overflow: hidden;
        transition: all var(--transition-smooth, 250ms ease);
      }
      .sri-alert-bar {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 7px 14px;
        cursor: pointer;
        user-select: none;
      }
      .sri-alert-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 10px;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        font-weight: 700;
      }
      .sri-alert-dot {
        width: 7px;
        height: 7px;
        background: #ff3344;
        border-radius: 50%;
        box-shadow: 0 0 10px #ff3344;
        animation: sri-pulse 1.4s infinite;
      }
      @keyframes sri-pulse {
        0% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px #ff3344; }
        50% { opacity: 0.35; transform: scale(1.3); box-shadow: 0 0 12px #ff3344; }
        100% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px #ff3344; }
      }
      .sri-alert-view-btn {
        background: rgba(0, 212, 255, 0.08);
        border: 1px solid rgba(0, 212, 255, 0.28);
        color: var(--accent, #00d4ff);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1.2px;
        padding: 3px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 150ms ease;
      }
      .sri-alert-view-btn:hover {
        background: rgba(0, 212, 255, 0.18);
        border-color: rgba(0, 212, 255, 0.6);
      }
      .sri-alert-drawer {
        max-height: 320px;
        overflow-y: auto;
        padding: 6px 10px 10px 10px;
        border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
      }
      .sri-alert-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.04);
        border-radius: 6px;
        margin-bottom: 5px;
        cursor: pointer;
        border-left: 3px solid #ffaa00;
        transition: all 120ms ease;
      }
      .sri-alert-item:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
      }
      .sri-alert-item.crit {
        border-left-color: #ff3344;
        background: rgba(255, 51, 68, 0.06);
        border-color: rgba(255, 51, 68, 0.12);
      }
      .sri-alert-item.crit:hover {
        background: rgba(255, 51, 68, 0.1);
      }
      .sri-alert-item-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .sri-alert-item-icon {
        font-size: 14px;
        flex-shrink: 0;
      }
      .sri-alert-item-text {
        min-width: 0;
      }
      .sri-alert-item-title {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 320px;
      }
      .sri-alert-item-sub {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 8.5px;
        letter-spacing: 0.4px;
        color: var(--text-dim, rgba(232, 234, 237, 0.4));
        margin-top: 1px;
      }
      .sri-fly-btn {
        background: rgba(0, 212, 255, 0.08);
        border: 1px solid rgba(0, 212, 255, 0.28);
        color: var(--accent, #00d4ff);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        padding: 4px 8px;
        border-radius: 5px;
        cursor: pointer;
        flex-shrink: 0;
        margin-left: 10px;
        transition: all 120ms ease;
      }
      .sri-fly-btn:hover {
        background: rgba(0, 212, 255, 0.22);
        border-color: rgba(0, 212, 255, 0.65);
        box-shadow: 0 0 10px rgba(0, 212, 255, 0.35);
      }
    `;
    document.head.appendChild(style);
  }
}
