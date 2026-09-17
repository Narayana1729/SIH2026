/**
 * @module ui/hud/quickZoneBar
 * @description Tactical Quick-Dial Hot Zone Toolbar for sriVision.
 * Provides one-click camera flights and layer activations for critical operational sectors.
 */

import * as Cesium from 'cesium';
import { tacticalAudio } from '../../core/audio.js';

export const OPERATIONAL_ZONES = Object.freeze([
  {
    id: 'zone-vizag',
    name: 'HPCL VIZAG',
    badge: 'REFINERY',
    subtitle: 'HPCL Visakh Refinery & Petrochemicals',
    target: { lon: 83.2519, lat: 17.6886, height: 28000, pitch: -45 },
    layerId: 'hazard-industrial',
  },
  {
    id: 'zone-jamnagar',
    name: 'JAMNAGAR',
    badge: 'PETROCHEM',
    subtitle: 'Jamnagar Petrochemical Complex',
    target: { lon: 70.057, lat: 22.470, height: 35000, pitch: -50 },
    layerId: 'hazard-industrial',
  },
  {
    id: 'zone-bombay-high',
    name: 'BOMBAY HIGH',
    badge: 'OFFSHORE',
    subtitle: 'Offshore Flaring Platforms',
    target: { lon: 71.380, lat: 19.420, height: 40000, pitch: -45 },
    layerId: 'hazard-industrial',
  },
  {
    id: 'zone-korba',
    name: 'KORBA POWER',
    badge: 'POWER/MINE',
    subtitle: 'Thermal & Mining Corridor',
    target: { lon: 82.680, lat: 22.350, height: 32000, pitch: -50 },
    layerId: 'hazard-industrial',
  },
  {
    id: 'zone-overview',
    name: 'INDIA GRID',
    badge: 'NATIONAL',
    subtitle: 'National Overview — Reset View',
    target: { lon: 78.96, lat: 21.50, height: 3200000, pitch: -90 },
  },
]);

export class QuickZoneBar {
  constructor(viewer, hazardLayerManager) {
    this.viewer = viewer;
    this.hazardLayerManager = hazardLayerManager;
    this.container = document.createElement('div');
    this.container.id = 'sri-quickzone-bar';
    this.container.className = 'sri-quickzone-bar';
    document.body.appendChild(this.container);

    this.isCollapsed = false;
    this._injectStyles();
    this.render();
  }

  render() {
    const buttonsHtml = OPERATIONAL_ZONES.map((z) => `
      <button type="button" class="sri-zone-chip" data-zone-id="${z.id}" title="${z.subtitle}">
        <span class="sri-zone-dot"></span>
        <span class="sri-zone-label">${z.name}</span>
        <span class="sri-zone-badge">${z.badge}</span>
      </button>
    `).join('');

    this.container.innerHTML = `
      <div class="sri-zone-inner ${this.isCollapsed ? 'collapsed' : ''}">
        <div class="sri-zone-head">
          <span class="sri-zone-kicker">SECTORS:</span>
        </div>
        ${!this.isCollapsed ? `
          <div class="sri-zone-list">
            ${buttonsHtml}
          </div>
        ` : ''}
        <button type="button" class="sri-zone-toggle-btn" id="sri-zone-toggle" title="${this.isCollapsed ? 'Expand Sectors' : 'Collapse Sectors'}">
          ${this.isCollapsed ? '▼' : '▲'}
        </button>
      </div>
    `;

    this.container.querySelectorAll('.sri-zone-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const zoneId = btn.getAttribute('data-zone-id');
        const zone = OPERATIONAL_ZONES.find((z) => z.id === zoneId);
        if (!zone) return;

        tacticalAudio.playFlyTo();

        if (this.viewer && zone.target) {
          const t = zone.target;
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(t.lon, t.lat, t.height),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(t.pitch || -60),
              roll: 0.0,
            },
            duration: 2.0,
            complete: () => {
              if (zone.id === 'zone-overview') {
                // National overview reset: clear focused facility overlay
                const indLayer = this.hazardLayerManager?.getLayer('hazard-industrial');
                if (indLayer) indLayer.clearSelectedOverlays();
              } else {
                // Focus facility without fabricating unverified thermal anomalies
                const indLayer = this.hazardLayerManager?.getLayer('hazard-industrial');
                if (indLayer) {
                  const facility = indLayer.findFacilityNear(t.lat, t.lon);
                  if (facility) {
                    indLayer.onSelect(facility);
                  }
                }
              }
            },
          });
        }

        if (zone.layerId && this.hazardLayerManager) {
          this.hazardLayerManager.toggleLayer(zone.layerId, true);
        }
      });
    });

    document.getElementById('sri-zone-toggle')?.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      tacticalAudio.playClick();
      this.render();
    });
  }

  _injectStyles() {
    if (document.getElementById('sri-quickzone-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-quickzone-styles';
    style.textContent = `
      #sri-quickzone-bar {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 996;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        pointer-events: auto;
      }
      .sri-zone-inner {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--glass-bg, rgba(12, 14, 22, 0.88));
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
        border-radius: 999px;
        padding: 5px 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 212, 255, 0.08) inset;
        transition: all 200ms ease;
      }
      .sri-zone-inner.collapsed {
        padding: 4px 10px;
      }
      .sri-zone-kicker {
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 1.5px;
        color: var(--accent, #00d4ff);
        text-transform: uppercase;
        margin-right: 4px;
        user-select: none;
      }
      .sri-zone-list {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sri-zone-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 999px;
        padding: 4px 10px;
        color: var(--text-primary, #e8eaed);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.8px;
        cursor: pointer;
        transition: all 150ms ease;
        white-space: nowrap;
      }
      .sri-zone-chip:hover {
        background: rgba(0, 212, 255, 0.15);
        border-color: rgba(0, 212, 255, 0.5);
        color: #fff;
        box-shadow: 0 0 12px rgba(0, 212, 255, 0.25);
      }
      .sri-zone-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #00d4ff;
        box-shadow: 0 0 6px #00d4ff;
      }
      .sri-zone-badge {
        font-size: 8px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.06);
        padding: 1px 5px;
        border-radius: 4px;
      }
      .sri-zone-toggle-btn {
        background: transparent;
        border: none;
        color: var(--text-dim, rgba(232, 234, 237, 0.4));
        font-size: 8px;
        padding: 2px 4px;
        cursor: pointer;
        transition: color 150ms ease;
      }
      .sri-zone-toggle-btn:hover {
        color: var(--accent, #00d4ff);
      }
    `;
    document.head.appendChild(style);
  }
}
