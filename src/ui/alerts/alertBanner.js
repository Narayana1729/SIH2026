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
      const isCrit = inc.severity === SEVERITY_LEVELS.CRITICAL;
      const isLive = inc.source_type === 'REAL_LIVE' || inc.provenance?.source_type === 'REAL_LIVE' || inc.is_live;
      const provenanceLabel = isLive ? 'LIVE / NRT' : 'VERIFIED FIRMS';
      const provColor = isLive ? '#34d399' : '#94a3b8';
      const provBg = isLive ? 'rgba(52, 211, 153, 0.12)' : 'rgba(148, 163, 184, 0.12)';

      // Strip any residual emojis from titles
      const cleanTitle = (inc.title || 'Thermal Event').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

      return `
        <div class="sri-alert-item ${isCrit ? 'crit' : 'high'}" data-hazard-id="${inc.id}">
          <div class="sri-alert-item-left">
            <span class="sri-alert-status-dot ${isCrit ? 'crit' : 'warn'}"></span>
            <div class="sri-alert-item-text">
              <div class="sri-alert-item-title">${cleanTitle}</div>
              <div class="sri-alert-item-sub">
                <span style="display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 8px; font-weight: 700; color: ${provColor}; background: ${provBg}; margin-right: 4px;">${provenanceLabel}</span>
                ${inc.subtitle || inc.location?.locality || ''}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
            <button class="sri-plume-btn" data-lat="${inc.location.latitude}" data-lon="${inc.location.longitude}" data-hazard-id="${inc.id}" title="Run Atmospheric Plume Simulation">
              PLUME
            </button>
            <button class="sri-fly-btn" data-lat="${inc.location.latitude}" data-lon="${inc.location.longitude}" title="Fly to Coordinate">
              FLY TO
            </button>
          </div>
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

    this.container.querySelectorAll('.sri-plume-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lat = Number(btn.getAttribute('data-lat'));
        const lon = Number(btn.getAttribute('data-lon'));
        const id = btn.getAttribute('data-hazard-id');
        const match = this.incidents.find((i) => i.id === id);

        if (this.viewer && !isNaN(lat) && !isNaN(lon)) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, 18000),
            duration: 1.5,
          });
        }
        if (match && this.onSelectHazard) {
          this.onSelectHazard(match);
        }

        // Trigger plume simulation event
        eventBus.emit(SRI_EVENTS.SIMULATION_REQUESTED, {
          latitude: lat,
          longitude: lon,
          incident_title: match?.title || 'Industrial Thermal Incident',
          chemical: 'BENZENE',
          release_rate_kg_s: 15.0,
        });
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
        position: fixed;
        top: 58px;
        left: 20px;
        z-index: 998;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        pointer-events: auto;
        max-width: 320px;
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
      .sri-alert-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .sri-alert-status-dot.crit {
        background: #ef4444;
        box-shadow: 0 0 6px rgba(239, 68, 68, 0.7);
      }
      .sri-alert-status-dot.warn {
        background: #f59e0b;
        box-shadow: 0 0 6px rgba(245, 158, 11, 0.7);
      }
      .sri-alert-item-text {
        min-width: 0;
      }
      .sri-alert-item-title {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 220px;
      }
      .sri-alert-item-sub {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9.5px;
        letter-spacing: 0.2px;
        color: var(--text-dim, rgba(232, 234, 237, 0.5));
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 220px;
      }
      .sri-fly-btn, .sri-plume-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #e2e8f0;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.8px;
        padding: 4px 7px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 120ms ease;
      }
      .sri-fly-btn:hover {
        background: rgba(0, 212, 255, 0.2);
        border-color: rgba(0, 212, 255, 0.6);
        color: #fff;
      }
      .sri-plume-btn:hover {
        background: rgba(249, 115, 22, 0.2);
        border-color: rgba(249, 115, 22, 0.6);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }
}
