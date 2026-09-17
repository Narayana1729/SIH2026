/**
 * @module ui/hud/hazardTooltip
 * @description Real-Time 3D Globe Cursor Hover Tooltip for sriVision.
 * Displays immediate situational telemetry when hovering over any hazard pin.
 */

import * as Cesium from 'cesium';
import { HAZARD_ICONS, SEVERITY_COLORS } from '../../core/risk.js';

export class HazardTooltip {
  constructor(viewer) {
    this.viewer = viewer;
    this.el = document.createElement('div');
    this.el.id = 'sri-hazard-tooltip';
    this.el.className = 'sri-hazard-tooltip';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    this._handler = null;
    this._hoveredEntity = null;

    this._injectStyles();
    this._initHandler();
  }

  _initHandler() {
    if (!this.viewer || this.viewer.isDestroyed()) return;

    this._handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this._handler.setInputAction((movement) => {
      const pickedObject = this.viewer.scene.pick(movement.endPosition);

      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id._sriHazardContract) {
        const hazard = pickedObject.id._sriHazardContract;
        this._showTooltip(hazard, movement.endPosition);
      } else {
        this._hideTooltip();
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  _showTooltip(hazard, position) {
    const icon = HAZARD_ICONS[hazard.hazard_type] || '📍';
    const sev = SEVERITY_COLORS[hazard.severity] || SEVERITY_COLORS.MODERATE;

    let metricSnippet = '';
    if (hazard.metrics && hazard.metrics.length > 0) {
      const m = hazard.metrics[0];
      metricSnippet = `<div class="sri-tt-metric">${m.label}: <strong>${m.value} ${m.unit || ''}</strong></div>`;
    }

    this.el.innerHTML = `
      <div class="sri-tt-header">
        <span class="sri-tt-icon">${icon}</span>
        <span class="sri-tt-title">${hazard.title || 'Hazard Target'}</span>
      </div>
      <div class="sri-tt-sub">${hazard.subtitle || ''}</div>
      ${metricSnippet}
      <div class="sri-tt-footer">
        <span class="sri-tt-badge" style="background:${sev.hex}; color:#fff;">${hazard.severity || 'ACTIVE'}</span>
        <span class="sri-tt-hint">Click to Inspect · Shift+Click Probe</span>
      </div>
    `;

    const x = Math.min(position.x + 16, window.innerWidth - 260);
    const y = Math.min(position.y + 16, window.innerHeight - 120);

    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.style.display = 'block';
  }

  _hideTooltip() {
    this.el.style.display = 'none';
  }

  _injectStyles() {
    if (document.getElementById('sri-tooltip-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-tooltip-styles';
    style.textContent = `
      .sri-hazard-tooltip {
        position: absolute;
        z-index: 1000;
        pointer-events: none;
        width: 250px;
        background: var(--glass-bg, rgba(10, 14, 22, 0.92));
        backdrop-filter: blur(20px) saturate(1.4);
        -webkit-backdrop-filter: blur(20px) saturate(1.4);
        border: 1px solid var(--glass-border, rgba(0, 212, 255, 0.3));
        border-radius: 8px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 10px rgba(0, 212, 255, 0.2);
        padding: 8px 10px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        color: var(--text-primary, #e8eaed);
        transition: opacity 120ms ease;
      }
      .sri-tt-header {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sri-tt-icon { font-size: 13px; }
      .sri-tt-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sri-tt-sub {
        font-size: 8.5px;
        color: var(--accent, #00d4ff);
        margin: 2px 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sri-tt-metric {
        font-size: 8.5px;
        color: var(--text-dim, rgba(232, 234, 237, 0.6));
        background: rgba(255, 255, 255, 0.03);
        padding: 3px 6px;
        border-radius: 4px;
        margin-bottom: 5px;
      }
      .sri-tt-metric strong { color: #00e5ff; }
      .sri-tt-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 4px;
      }
      .sri-tt-badge {
        font-size: 7.5px;
        font-weight: 700;
        letter-spacing: 0.8px;
        padding: 1px 5px;
        border-radius: 3px;
        text-transform: uppercase;
      }
      .sri-tt-hint {
        font-size: 7.5px;
        letter-spacing: 0.4px;
        color: var(--text-dim, rgba(232, 234, 237, 0.4));
      }
    `;
    document.head.appendChild(style);
  }

  destroy() {
    if (this._handler) {
      this._handler.destroy();
      this._handler = null;
    }
    this.el?.remove();
  }
}
