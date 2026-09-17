/**
 * @module ui/hud/quickZoneBar
 * @description Tactical Quick-Dial Hot Zone Toolbar for sriVision.
 * Provides one-click camera flights and layer activations for critical operational sectors.
 */

import * as Cesium from 'cesium';
import { tacticalAudio } from '../../core/audio.js';

export const OPERATIONAL_ZONES = Object.freeze([
  {
    id: 'zone-wayanad',
    name: 'WAYANAD',
    icon: '🏔️',
    subtitle: 'Landslide (FS: 1.17)',
    target: { lon: 76.13, lat: 11.60, height: 48000, pitch: -45 },
    layerId: 'hazard-landslide',
  },
  {
    id: 'zone-rishiganga',
    name: 'RISHIGANGA',
    icon: '🌊',
    subtitle: 'Surge: +3.95m',
    target: { lon: 79.72, lat: 30.55, height: 42000, pitch: -40 },
    layerId: 'hazard-flood',
  },
  {
    id: 'zone-jamnagar',
    name: 'JAMNAGAR',
    icon: '🏭',
    subtitle: 'Benzene Plume Sim',
    target: { lon: 70.057, lat: 22.470, height: 65000, pitch: -50 },
    layerId: 'hazard-dispersion',
  },
  {
    id: 'zone-similipal',
    name: 'SIMILIPAL',
    icon: '🔥',
    subtitle: 'Wildfire Hotspots',
    target: { lon: 86.35, lat: 21.85, height: 85000, pitch: -55 },
    layerId: 'hazard-wildfire',
  },
  {
    id: 'zone-overview',
    name: 'INDIA GRID',
    icon: '🇮🇳',
    subtitle: 'National Command',
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
    const isAudioOn = tacticalAudio.enabled;

    const buttonsHtml = OPERATIONAL_ZONES.map((z) => `
      <button type="button" class="sri-zone-chip" data-zone-id="${z.id}" title="${z.subtitle}">
        <span class="sri-zone-icon">${z.icon}</span>
        <span class="sri-zone-label">${z.name}</span>
      </button>
    `).join('');

    this.container.innerHTML = `
      <div class="sri-zone-inner ${this.isCollapsed ? 'collapsed' : ''}">
        <div class="sri-zone-head">
          <span class="sri-zone-kicker">HOT ZONES:</span>
        </div>
        ${!this.isCollapsed ? `
          <div class="sri-zone-list">
            ${buttonsHtml}
          </div>
          <button type="button" class="sri-audio-toggle-btn" id="sri-audio-toggle" title="Toggle Tactical Audio FX">
            ${isAudioOn ? '🔊 SFX' : '🔇 SFX'}
          </button>
        ` : ''}
        <button type="button" class="sri-zone-toggle-btn" id="sri-zone-toggle" title="${this.isCollapsed ? 'Expand Hot Zones' : 'Collapse Hot Zones'}">
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
          });
        }

        if (zone.layerId && this.hazardLayerManager) {
          this.hazardLayerManager.toggleLayer(zone.layerId, true);
        }
      });
    });

    document.getElementById('sri-audio-toggle')?.addEventListener('click', () => {
      const state = tacticalAudio.toggleAudio();
      tacticalAudio.playClick();
      const btn = document.getElementById('sri-audio-toggle');
      if (btn) btn.textContent = state ? '🔊 SFX' : '🔇 SFX';
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
        position: absolute;
        top: 56px;
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
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 1.5px;
        color: var(--accent, #00d4ff);
        text-transform: uppercase;
        margin-right: 2px;
        user-select: none;
      }
      .sri-zone-list {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .sri-zone-chip {
        display: flex;
        align-items: center;
        gap: 5px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        padding: 4px 9px;
        color: var(--text-primary, #e8eaed);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 150ms ease;
        white-space: nowrap;
      }
      .sri-zone-chip:hover {
        background: rgba(0, 212, 255, 0.15);
        border-color: rgba(0, 212, 255, 0.5);
        color: #fff;
        box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
      }
      .sri-zone-icon { font-size: 11px; }
      .sri-audio-toggle-btn {
        margin-left: 4px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 999px;
        padding: 4px 8px;
        color: var(--text-dim, rgba(232, 234, 237, 0.5));
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 150ms ease;
        white-space: nowrap;
      }
      .sri-audio-toggle-btn:hover {
        color: #fff;
        border-color: rgba(255, 255, 255, 0.25);
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
