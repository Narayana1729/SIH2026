/**
 * @module ui/hud/segregationFilterBar
 * @description Real-Time Thermal Category Segregation Filter Toolbar for PyroSat.
 *
 * Provides live instant toggling and filtering of satellite thermal anomalies directly on the 3D globe:
 *   - ALL HOTSPOTS
 *   - INDUSTRIAL (Refinery Flares & Disasters)
 *   - ROUTINE GAS FLARES (Controlled operational heat)
 *   - INDUSTRIAL DISASTERS (Explosions & thermal surges)
 *   - FOREST WILDFIRES (Vegetation & canopy fires)
 *   - AGRICULTURAL BURNING (Crop stubble residue)
 *   - MINING & COAL SEAMS (Smelting & open-cast coal fires)
 */

import * as Cesium from 'cesium';
import { tacticalAudio } from '../../core/audio.js';
import { eventBus, SRI_EVENTS } from '../../core/eventBus.js';

export const FILTER_CATEGORIES = Object.freeze([
  { id: 'ALL', label: 'ALL', icon: '🌐', color: '#00d4ff' },
  { id: 'INDUSTRIAL', label: 'INDUSTRIAL', icon: '🏭', color: '#38bdf8' },
  { id: 'INDUSTRIAL_FLARE', label: 'FLARES', icon: '⚡', color: '#a855f7' },
  { id: 'FOREST_WILDFIRE', label: 'WILDFIRE', icon: '🌲', color: '#ea580c' },
  { id: 'AGRICULTURAL_BURNING', label: 'AGRI', icon: '🌾', color: '#facc15' },
  { id: 'MINING_SMELTING', label: 'MINING', icon: '⛏️', color: '#fb923c' },
]);

export class SegregationFilterBar {
  constructor(hazardLayerManager, viewer = null) {
    this.hazardLayerManager = hazardLayerManager;
    this.viewer = viewer || (typeof window !== 'undefined' ? window.viewer : null);
    this.container = document.createElement('div');
    this.container.id = 'sri-segregation-bar';
    this.container.className = 'sri-segregation-bar';
    document.body.appendChild(this.container);

    this.activeFilter = 'ALL';
    this.counts = {
      ALL: 0,
      INDUSTRIAL: 0,
      INDUSTRIAL_FLARE: 0,
      FOREST_WILDFIRE: 0,
      AGRICULTURAL_BURNING: 0,
      MINING_SMELTING: 0,
    };

    this._injectStyles();
    this.render();

    // Listen for live counts from WildfireLayer
    eventBus.on('srivision:category-counts-updated', (newCounts) => {
      if (newCounts && typeof newCounts === 'object') {
        this.counts = { ...this.counts, ...newCounts };
        this._updateCountsDisplay();
      }
    });
  }

  setFilter(categoryKey, options = {}) {
    if (options.zoomOut !== false) {
      this._zoomToIndia();
    }
    this.activeFilter = categoryKey;
    if (options.silent !== true) {
      tacticalAudio.playClick();
    }

    // Update active class on DOM buttons
    this.container.querySelectorAll('.sri-filter-chip').forEach((btn) => {
      const catId = btn.getAttribute('data-cat-id');
      if (catId === categoryKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Broadcast filter change across the application
    eventBus.emit(SRI_EVENTS.CATEGORY_FILTER_CHANGED, { category: categoryKey, flyTo: false });

    // Directly trigger WildfireLayer if accessible
    const wildfireLayer = this.hazardLayerManager?.getLayer('hazard-wildfire');
    if (wildfireLayer?.applyCategoryFilter) {
      wildfireLayer.applyCategoryFilter(categoryKey, { flyTo: false });
    }
  }

  _zoomToIndia() {
    const v = this.viewer || (typeof window !== 'undefined' ? window.viewer : null);
    if (!v?.camera) return;
    try {
      v.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(78.9629, 21.5000, 3600000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-88),
          roll: 0.0,
        },
        duration: 1.5,
      });
    } catch {
      // Fallback if Cesium camera is unavailable
    }
  }

  _updateCountsDisplay() {
    this.container.querySelectorAll('.sri-filter-chip').forEach((btn) => {
      const catId = btn.getAttribute('data-cat-id');
      const badge = btn.querySelector('.sri-filter-count');
      if (badge && this.counts[catId] !== undefined) {
        badge.textContent = this.counts[catId];
        badge.style.display = this.counts[catId] > 0 ? 'inline-block' : 'none';
      }
    });
  }

  render() {
    const chipsHtml = FILTER_CATEGORIES.map((cat) => {
      const isActive = this.activeFilter === cat.id;
      const count = this.counts[cat.id] || 0;
      return `
        <button
          type="button"
          class="sri-filter-chip ${isActive ? 'active' : ''}"
          data-cat-id="${cat.id}"
          style="--chip-accent: ${cat.color};"
          title="Filter Live Anomalies by ${cat.label}"
        >
          <span class="sri-filter-icon">${cat.icon}</span>
          <span class="sri-filter-text">${cat.label}</span>
          <span class="sri-filter-count" style="display: ${count > 0 ? 'inline-block' : 'none'};">${count}</span>
        </button>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="sri-segregation-inner">
        <div class="sri-segregation-label">
          <span class="sri-segregation-kicker">SEGREGATION:</span>
        </div>
        <div class="sri-filter-list">
          ${chipsHtml}
        </div>
      </div>
    `;

    // Attach click handlers
    this.container.querySelectorAll('.sri-filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        this.setFilter(catId);
      });
    });
  }

  _injectStyles() {
    if (document.getElementById('sri-segregation-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-segregation-styles';
    style.textContent = `
      #sri-segregation-bar {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 995;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        pointer-events: auto;
        user-select: none;
        max-width: calc(100vw - 520px);
      }
      .sri-segregation-inner {
        display: flex;
        align-items: center;
        gap: 5px;
        background: rgba(10, 14, 24, 0.92);
        backdrop-filter: blur(20px) saturate(1.4);
        -webkit-backdrop-filter: blur(20px) saturate(1.4);
        border: 1px solid rgba(0, 212, 255, 0.22);
        border-radius: 999px;
        padding: 3px 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 212, 255, 0.1) inset;
        white-space: nowrap;
        transition: all 200ms ease;
      }
      .sri-segregation-kicker {
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 1.2px;
        color: #00d4ff;
        text-transform: uppercase;
        margin-right: 2px;
      }
      .sri-filter-list {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .sri-filter-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border-radius: 999px;
        padding: 2px 7px;
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.4px;
        cursor: pointer;
        transition: all 180ms ease;
      }
      .sri-filter-chip:hover {
        background: rgba(255, 255, 255, 0.09);
        border-color: var(--chip-accent, #00d4ff);
        color: #ffffff;
        transform: translateY(-1px);
      }
      .sri-filter-chip.active {
        background: rgba(0, 212, 255, 0.15);
        border-color: var(--chip-accent, #00d4ff);
        color: #ffffff;
        box-shadow: 0 0 10px var(--chip-accent, #00d4ff), 0 0 3px var(--chip-accent, #00d4ff) inset;
      }
      .sri-filter-icon {
        font-size: 10px;
      }
      .sri-filter-count {
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid var(--chip-accent, rgba(255, 255, 255, 0.2));
        border-radius: 999px;
        padding: 0 4px;
        font-size: 8.5px;
        font-weight: 700;
        color: var(--chip-accent, #00d4ff);
        margin-left: 2px;
      }
      @media (max-width: 1250px) {
        .sri-segregation-kicker {
          display: none;
        }
      }
      @media (max-width: 1050px) {
        #sri-segregation-bar {
          top: 56px;
          left: 50%;
          transform: translateX(-50%);
          max-width: 90vw;
        }
    `;
    document.head.appendChild(style);
  }
}
