/**
 * @module ui/hud/zoomSliderBar
 * @description Tactical Zoom In / Zoom Out Slider & Altitude Gauge for PyroSat.
 *
 * Provides:
 *   - Continuous smooth Zoom In (+) and Zoom Out (-) with click & hold support
 *   - Logarithmic vertical camera altitude slider synchronized bi-directionally with Cesium
 *   - Rapid-dial operational presets (TACTICAL, REGIONAL, STRATO, ORBIT)
 *   - Live digital altitude readout in JetBrains Mono
 *   - One-click National Overview globe reset
 */

import * as Cesium from 'cesium';
import { tacticalAudio } from '../../core/audio.js';

export const ZOOM_PRESETS = Object.freeze([
  { id: 'tactical', label: 'TAC', height: 2500, title: 'Tactical Facility Hotspot (~2.5 km)' },
  { id: 'regional', label: 'REG', height: 35000, title: 'Regional Thermal Corridor (~35 km)' },
  { id: 'strato', label: 'STR', height: 250000, title: 'Stratospheric Pass (~250 km)' },
  { id: 'orbit', label: 'ORB', height: 12000000, title: 'Orbital Space View (~12,000 km)' },
]);

export class ZoomSliderBar {
  /**
   * @param {Cesium.Viewer} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.container = document.createElement('div');
    this.container.id = 'sri-zoom-slider-bar';
    this.container.className = 'sri-zoom-slider-bar';
    document.body.appendChild(this.container);

    this.MIN_ALT_M = 300;        // 300 m (tactical facility level)
    this.MAX_ALT_M = 18000000;   // 18,000 km (full globe in space)

    this.isDragging = false;
    this.holdInterval = null;
    this._cameraListener = null;

    this._injectStyles();
    this.render();
    this._bindEvents();
    this._bindCameraSync();
  }

  /**
   * Convert camera height in meters to a slider value [0..100] (Logarithmic scale).
   * 0 = Space (18,000 km), 100 = Ground (300 m).
   */
  _altToValue(heightM) {
    const clamped = Math.max(this.MIN_ALT_M, Math.min(this.MAX_ALT_M, heightM));
    const logMin = Math.log(this.MIN_ALT_M);
    const logMax = Math.log(this.MAX_ALT_M);
    const fraction = (logMax - Math.log(clamped)) / (logMax - logMin);
    return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  }

  /**
   * Convert slider value [0..100] to camera height in meters.
   */
  _valueToAlt(val) {
    const fraction = Math.max(0, Math.min(100, val)) / 100;
    const logMin = Math.log(this.MIN_ALT_M);
    const logMax = Math.log(this.MAX_ALT_M);
    return Math.exp(logMax - fraction * (logMax - logMin));
  }

  /**
   * Format altitude for human-readable digital readout.
   */
  _formatAlt(heightM) {
    if (!heightM || isNaN(heightM)) return '--';
    if (heightM >= 1000) {
      const km = heightM / 1000;
      if (km >= 100) return `${Math.round(km).toLocaleString()} KM`;
      return `${km.toFixed(1)} KM`;
    }
    return `${Math.round(heightM)} M`;
  }

  /**
   * Smoothly zoom in towards the screen focal center.
   * @param {number} factor
   */
  zoomIn(factor = 0.32) {
    if (!this.viewer?.camera) return;
    const height = this.viewer.camera.positionCartographic?.height || 100000;
    const moveDistance = Math.max(30, height * factor);
    this.viewer.camera.zoomIn(moveDistance);
    this.viewer.scene.requestRender();
    this._updateFromCamera();
  }

  /**
   * Smoothly zoom out away from the screen focal center.
   * @param {number} factor
   */
  zoomOut(factor = 0.40) {
    if (!this.viewer?.camera) return;
    const height = this.viewer.camera.positionCartographic?.height || 100000;
    const moveDistance = Math.max(30, height * factor);
    this.viewer.camera.zoomOut(moveDistance);
    this.viewer.scene.requestRender();
    this._updateFromCamera();
  }

  /**
   * Move camera directly to target height along the ground pick ray without losing look direction.
   */
  _applyZoom(targetHeight) {
    if (!this.viewer?.camera) return;
    const camera = this.viewer.camera;
    const canvas = this.viewer.canvas;

    let targetGround = null;
    if (canvas && canvas.clientWidth && canvas.clientHeight) {
      const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
      const ray = camera.getPickRay(center);
      if (ray) {
        targetGround = this.viewer.scene.globe?.pick(ray, this.viewer.scene)
          || camera.pickEllipsoid(center, Cesium.Ellipsoid.WGS84);
      }
    }

    if (targetGround) {
      const currentPos = camera.positionWC;
      const currentDist = Cesium.Cartesian3.distance(currentPos, targetGround);
      const cartoCurrent = camera.positionCartographic;
      const cartoTarget = Cesium.Cartographic.fromCartesian(targetGround);

      const currentDeltaH = Math.max(10, (cartoCurrent?.height || 1000) - cartoTarget.height);
      const desiredDeltaH = Math.max(10, targetHeight - cartoTarget.height);
      const scale = desiredDeltaH / currentDeltaH;
      const desiredDist = Math.max(40, currentDist * scale);

      const dirFromTarget = Cesium.Cartesian3.subtract(currentPos, targetGround, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(dirFromTarget, dirFromTarget);
      Cesium.Cartesian3.multiplyByScalar(dirFromTarget, desiredDist, dirFromTarget);
      const newPos = Cesium.Cartesian3.add(targetGround, dirFromTarget, new Cesium.Cartesian3());

      camera.position = newPos;
    } else {
      const carto = camera.positionCartographic;
      if (carto) {
        camera.setView({
          destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, targetHeight),
          orientation: {
            heading: camera.heading,
            pitch: camera.pitch,
            roll: camera.roll,
          },
        });
      }
    }

    this.viewer.scene.requestRender();
    this._updateReadout(targetHeight);
  }

  /**
   * Fly camera smoothly to a preset altitude level.
   */
  flyToPreset(targetHeight) {
    tacticalAudio.playClick();
    const camera = this.viewer?.camera;
    const carto = camera?.positionCartographic;
    if (!carto) return;

    camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, targetHeight),
      duration: 1.4,
      orientation: {
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll,
      },
    });
  }

  /**
   * Reset camera to National India Overview.
   */
  resetGlobe() {
    tacticalAudio.playClick();
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(78.9629, 21.5000, 3400000),
      duration: 1.8,
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-88),
        roll: 0,
      },
    });
  }

  _updateReadout(heightM) {
    const valEl = document.getElementById('sri-zoom-alt-val');
    if (valEl) {
      valEl.textContent = this._formatAlt(heightM);
    }
  }

  _updateFromCamera() {
    if (this.isDragging) return;
    const height = this.viewer?.camera?.positionCartographic?.height;
    if (height !== undefined && height !== null) {
      const sliderVal = this._altToValue(height);
      const slider = document.getElementById('sri-zoom-range');
      if (slider) {
        slider.value = sliderVal;
      }
      this._updateReadout(height);
    }
  }

  _bindCameraSync() {
    if (!this.viewer?.camera) return;

    this._cameraListener = () => {
      this._updateFromCamera();
    };

    this.viewer.camera.changed.addEventListener(this._cameraListener);
    // Initial sync
    setTimeout(() => this._updateFromCamera(), 300);
  }

  _bindEvents() {
    const zoomInBtn = document.getElementById('sri-zoom-in');
    const zoomOutBtn = document.getElementById('sri-zoom-out');
    const slider = document.getElementById('sri-zoom-range');
    const resetBtn = document.getElementById('sri-zoom-reset');

    // Click & continuous hold on Zoom In
    const startZoomIn = (e) => {
      e.preventDefault();
      tacticalAudio.playClick();
      this.zoomIn();
      this.holdInterval = setInterval(() => {
        this.zoomIn(0.12);
      }, 50);
    };

    const stopHold = () => {
      if (this.holdInterval) {
        clearInterval(this.holdInterval);
        this.holdInterval = null;
      }
    };

    zoomInBtn?.addEventListener('mousedown', startZoomIn);
    zoomInBtn?.addEventListener('touchstart', startZoomIn, { passive: false });
    window.addEventListener('mouseup', stopHold);
    window.addEventListener('touchend', stopHold);

    // Click & continuous hold on Zoom Out
    const startZoomOut = (e) => {
      e.preventDefault();
      tacticalAudio.playClick();
      this.zoomOut();
      this.holdInterval = setInterval(() => {
        this.zoomOut(0.14);
      }, 50);
    };

    zoomOutBtn?.addEventListener('mousedown', startZoomOut);
    zoomOutBtn?.addEventListener('touchstart', startZoomOut, { passive: false });

    // Slider dragging
    slider?.addEventListener('input', (e) => {
      this.isDragging = true;
      const val = parseFloat(e.target.value);
      const targetAlt = this._valueToAlt(val);
      this._applyZoom(targetAlt);
    });

    slider?.addEventListener('change', () => {
      this.isDragging = false;
      this._updateFromCamera();
    });

    // Preset level chips
    this.container.querySelectorAll('.sri-zoom-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const presetId = chip.getAttribute('data-preset');
        const preset = ZOOM_PRESETS.find((p) => p.id === presetId);
        if (preset) {
          this.flyToPreset(preset.height);
        }
      });
    });

    // Reset button
    resetBtn?.addEventListener('click', () => {
      this.resetGlobe();
    });
  }

  render() {
    const currentHeight = this.viewer?.camera?.positionCartographic?.height || 3400000;
    const initialVal = this._altToValue(currentHeight);

    const presetsHtml = ZOOM_PRESETS.map((p) => `
      <button
        type="button"
        class="sri-zoom-preset-chip"
        data-preset="${p.id}"
        title="${p.title}"
      >${p.label}</button>
    `).join('');

    this.container.innerHTML = `
      <div class="sri-zoom-panel">
        <div class="sri-zoom-header">
          <span class="sri-zoom-kicker">OPTICAL</span>
        </div>

        <button type="button" class="sri-zoom-btn sri-zoom-in-btn" id="sri-zoom-in" title="Zoom In (Click or Hold)">
          <span class="material-symbols-outlined" aria-hidden="true">add</span>
        </button>

        <div class="sri-zoom-track-body">
          <div class="sri-zoom-presets">
            ${presetsHtml}
          </div>
          <div class="sri-zoom-slider-container">
            <input
              type="range"
              id="sri-zoom-range"
              class="sri-zoom-range"
              min="0"
              max="100"
              value="${initialVal}"
              step="0.5"
              aria-label="Camera Altitude Zoom Slider"
            />
          </div>
        </div>

        <button type="button" class="sri-zoom-btn sri-zoom-out-btn" id="sri-zoom-out" title="Zoom Out (Click or Hold)">
          <span class="material-symbols-outlined" aria-hidden="true">remove</span>
        </button>

        <div class="sri-zoom-alt-readout" id="sri-zoom-alt" title="Current Camera Altitude Above Terrain">
          <span class="sri-alt-kicker">ALTITUDE</span>
          <span class="sri-alt-val" id="sri-zoom-alt-val">${this._formatAlt(currentHeight)}</span>
        </div>

        <button type="button" class="sri-zoom-reset-btn" id="sri-zoom-reset" title="Reset View to National Overview">
          <span class="material-symbols-outlined" aria-hidden="true">public</span>
          <span class="sri-reset-label">RESET</span>
        </button>
      </div>
    `;
  }

  _injectStyles() {
    if (document.getElementById('sri-zoom-slider-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-zoom-slider-styles';
    style.textContent = `
      #sri-zoom-slider-bar {
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 994;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        pointer-events: auto;
        user-select: none;
      }
      .sri-zoom-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(10, 14, 24, 0.88);
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        border: 1px solid rgba(0, 212, 255, 0.25);
        border-radius: 18px;
        padding: 10px 8px;
        box-shadow: 0 10px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 212, 255, 0.1) inset;
        gap: 8px;
        width: 62px;
        transition: border-color 200ms ease, box-shadow 200ms ease;
      }
      .sri-zoom-panel:hover {
        border-color: rgba(0, 212, 255, 0.45);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 212, 255, 0.18) inset;
      }
      .sri-zoom-header {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sri-zoom-kicker {
        font-size: 7.5px;
        font-weight: 800;
        letter-spacing: 1.5px;
        color: rgba(0, 212, 255, 0.75);
        text-transform: uppercase;
      }
      .sri-zoom-btn {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #e8eaed;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 160ms ease;
        outline: none;
      }
      .sri-zoom-btn .material-symbols-outlined {
        font-size: 20px;
        line-height: 1;
      }
      .sri-zoom-btn:hover {
        background: rgba(0, 212, 255, 0.18);
        border-color: #00d4ff;
        color: #00d4ff;
        box-shadow: 0 0 14px rgba(0, 212, 255, 0.45);
        transform: scale(1.08);
      }
      .sri-zoom-btn:active {
        transform: scale(0.94);
        background: rgba(0, 212, 255, 0.35);
      }
      .sri-zoom-track-body {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 4px 0;
        position: relative;
      }
      .sri-zoom-presets {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 140px;
        gap: 4px;
      }
      .sri-zoom-preset-chip {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        color: rgba(232, 234, 237, 0.55);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 7.5px;
        font-weight: 700;
        letter-spacing: 0.5px;
        padding: 2px 3px;
        cursor: pointer;
        transition: all 140ms ease;
        text-align: center;
      }
      .sri-zoom-preset-chip:hover {
        border-color: #00d4ff;
        color: #00d4ff;
        background: rgba(0, 212, 255, 0.12);
        box-shadow: 0 0 8px rgba(0, 212, 255, 0.3);
      }
      .sri-zoom-slider-container {
        height: 140px;
        width: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .sri-zoom-range {
        -webkit-appearance: none;
        appearance: none;
        width: 140px;
        height: 5px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 999px;
        outline: none;
        transform: rotate(-90deg);
        transform-origin: center center;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(0, 212, 255, 0.15) inset;
        margin: 0;
      }
      .sri-zoom-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #00d4ff;
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px #00d4ff, 0 0 20px rgba(0, 212, 255, 0.6);
        cursor: grab;
        transition: transform 120ms ease;
      }
      .sri-zoom-range::-webkit-slider-thumb:hover {
        transform: scale(1.22);
      }
      .sri-zoom-range::-webkit-slider-thumb:active {
        cursor: grabbing;
        transform: scale(1.35);
        box-shadow: 0 0 16px #00d4ff, 0 0 28px rgba(0, 212, 255, 0.85);
      }
      .sri-zoom-range::-moz-range-thumb {
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #00d4ff;
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px #00d4ff;
        cursor: grab;
      }
      .sri-zoom-alt-readout {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(0, 212, 255, 0.18);
        border-radius: 6px;
        padding: 4px 5px;
        width: 100%;
        box-sizing: border-box;
      }
      .sri-alt-kicker {
        font-size: 6.5px;
        font-weight: 700;
        letter-spacing: 1px;
        color: rgba(232, 234, 237, 0.45);
        text-transform: uppercase;
      }
      .sri-alt-val {
        font-size: 8.5px;
        font-weight: 800;
        color: #00d4ff;
        letter-spacing: 0.5px;
        white-space: nowrap;
        text-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
        margin-top: 1px;
      }
      .sri-zoom-reset-btn {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: rgba(232, 234, 237, 0.7);
        padding: 4px 2px;
        cursor: pointer;
        transition: all 160ms ease;
        outline: none;
      }
      .sri-zoom-reset-btn .material-symbols-outlined {
        font-size: 16px;
      }
      .sri-reset-label {
        font-size: 7px;
        font-weight: 700;
        letter-spacing: 0.8px;
        margin-top: 1px;
      }
      .sri-zoom-reset-btn:hover {
        background: rgba(0, 212, 255, 0.15);
        border-color: #00d4ff;
        color: #00d4ff;
        box-shadow: 0 0 10px rgba(0, 212, 255, 0.35);
      }
      .sri-zoom-reset-btn:active {
        transform: scale(0.95);
      }
      @media (max-width: 768px) {
        #sri-zoom-slider-bar {
          right: 12px;
          transform: translateY(-50%) scale(0.9);
        }
      }
    `;
    document.head.appendChild(style);
  }
}
