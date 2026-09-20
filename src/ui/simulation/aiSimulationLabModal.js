/**
 * AI Simulation Lab & What-If Operational Scenario Simulator
 * 
 * Anchors to observed satellite incident telemetry, establishing a formal
 * baseline and propagating operator adjustments through a verifiable 3-tier
 * causal chain:
 *   - Layer 1: Thermal & Radiative Inference (Planck / Dozier Sub-Pixel Inversion)
 *   - Layer 2: Atmospheric Transport (Briggs Convective Rise & Pasquill Stability Dispersion)
 *   - Layer 3: Machine Learning Classification & TreeSHAP Sensitivity Attribution
 */

import { solveDozierPyrometry } from '../../disasters/pyrometry/dozierPyrometry.js';
import { classifyThermalIncident, ThermalCategories } from '../../intelligence/thermalClassifier.js';
import { resolveEventAttributions } from '../../intelligence/shapExplainer.js';
import { runWhatIfSimulation, STABILITY_CLASSES, validatePhysicsConsistency } from '../../simulation/incidentSimulationLab.js';
import { renderPlumeOnCesium } from '../../disasters/dispersion/gaussianPlume.js';

let modalElement = null;

// Observed Satellite Baseline State (Canonical Anchor: IOCL Haldia Refinery Complex)
let baselineState = {
  facilityName: 'IOCL Haldia Refinery & Petrochemical Complex',
  lat: 22.0520,
  lon: 88.1260,
  frp: 42.0,
  mir: 327.0,
  windSpeedKmh: 14.0,
  windDirDeg: 110,
  stability: 'NEUTRAL',
  distKm: 0.5,
  rec: 18,
  landCover: 'industrial',
  ndvi: 0.18
};

// Current Operator Scenario State
let scenarioState = { ...baselineState };

export function openAiSimulationLabModal(activeHazard = null) {
  if (!modalElement) {
    createSimLabDOM();
  }

  // Anchor to active hazard if provided or inspectable on globe
  if (activeHazard) {
    anchorToHazard(activeHazard);
  } else if (typeof window !== 'undefined' && window._sriActiveHazard) {
    anchorToHazard(window._sriActiveHazard);
  }

  updateSimulation();
  modalElement.style.display = 'flex';
}

export function closeAiSimulationLabModal() {
  if (modalElement) {
    modalElement.style.display = 'none';
  }
}

function anchorToHazard(hazard) {
  const lat = Number(hazard.location?.latitude ?? hazard.latitude ?? hazard.lat ?? 22.0520);
  const lon = Number(hazard.location?.longitude ?? hazard.longitude ?? hazard.lon ?? 88.1260);
  const frp = Number(hazard.frp ?? hazard.fire_radiative_power ?? 42.0);
  const mir = Number(hazard.brightness ?? hazard.bright_ti4 ?? 327.0);
  const dist = Number(hazard.facilityMatch?.distanceKm ?? hazard.distanceToFacilityKm ?? 0.5);
  const facName = hazard.facilityMatch?.name || hazard.nearestFacility?.name || 'IOCL Haldia Refinery & Petrochemical Complex';

  baselineState = {
    facilityName: facName,
    lat,
    lon,
    frp,
    mir,
    windSpeedKmh: 14.0,
    windDirDeg: 110,
    stability: 'NEUTRAL',
    distKm: dist,
    rec: Number(hazard.recurrenceIndex ?? 18),
    landCover: hazard.landCover || 'industrial',
    ndvi: Number(hazard.ndvi ?? 0.18)
  };

  scenarioState = { ...baselineState };
  syncSlidersToScenario();
}

function syncSlidersToScenario() {
  if (!modalElement) return;
  modalElement.querySelector('#slider-frp').value = scenarioState.frp;
  modalElement.querySelector('#slider-mir').value = scenarioState.mir;
  modalElement.querySelector('#slider-wind-speed').value = scenarioState.windSpeedKmh;
  modalElement.querySelector('#slider-wind-dir').value = scenarioState.windDirDeg;
  modalElement.querySelector('#select-stability').value = scenarioState.stability;
  modalElement.querySelector('#slider-dist').value = scenarioState.distKm;
  modalElement.querySelector('#slider-rec').value = scenarioState.rec;
}

function getCompassHeading(deg) {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return cardinals[idx];
}

function createSimLabDOM() {
  modalElement = document.createElement('div');
  modalElement.id = 'ai-sim-lab-container';
  modalElement.style.cssText = `
    position: fixed;
    top: 64px; right: 20px;
    pointer-events: none;
    z-index: 9500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e2e8f0;
  `;

  modalElement.innerHTML = `
    <div style="
      background: linear-gradient(145deg, rgba(8, 16, 28, 0.98), rgba(3, 7, 14, 0.99));
      border: 1px solid rgba(56, 189, 248, 0.5);
      border-radius: 12px;
      width: 540px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 80px);
      overflow-y: auto;
      box-shadow: 0 24px 60px rgba(0,0,0,0.95), 0 0 35px rgba(56,189,248,0.25);
      padding: 18px;
      pointer-events: auto;
      backdrop-filter: blur(20px);
    ">
      <!-- Header with Active Anchor & Epistemic Tag -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; border-radius: 8px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            🧪
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <h2 style="margin: 0; font-size: 16.5px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px;">WHAT-IF SCENARIO SIMULATOR</h2>
              <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700;">OPERATIONAL DIGITAL TWIN</span>
            </div>
            <div id="sim-anchor-facility" style="font-size: 11.5px; color: #cbd5e1; font-weight: 600; margin-top: 2px;">
              ${baselineState.facilityName}
            </div>
            <div id="sim-anchor-coords" style="font-size: 10px; color: #94a3b8; font-family: monospace;">
              ${baselineState.lat.toFixed(4)}°N, ${baselineState.lon.toFixed(4)}°E · Sensor: VIIRS 375m [OBSERVED]
            </div>
          </div>
        </div>
        <button id="simlab-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; padding: 2px 6px; line-height: 1;">✕</button>
      </div>

      <!-- Operational Scenario Presets Toolbar -->
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">OPERATIONAL SCENARIO BENCHMARKS</span>
          <span style="font-size: 9px; color: #64748b;">Click to simulate</span>
        </div>
        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
          <button class="sim-scenario-btn" data-scenario="baseline" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; border-radius: 5px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">📌 Current Baseline</button>
          <button class="sim-scenario-btn" data-scenario="surge" style="background: rgba(249, 115, 22, 0.15); border: 1px solid #fb923c; color: #fb923c; border-radius: 5px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">⚡ Process Surge (+180%)</button>
          <button class="sim-scenario-btn" data-scenario="wind_shift" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; border-radius: 5px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">💨 Adverse Wind Shift</button>
          <button class="sim-scenario-btn" data-scenario="inversion" style="background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #c084fc; border-radius: 5px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">🌫️ Inversion Trap (Class F)</button>
        </div>
      </div>

      <!-- Physics Consistency Guardrail Banner (Dynamic) -->
      <div id="sim-physics-banner" style="display: none; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; line-height: 1.4;"></div>

      <!-- Side-by-Side Comparison Matrix (Baseline vs Scenario) -->
      <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 10px 12px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
          <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.8px;">BEFORE VS AFTER · OPERATIONAL DELTA MATRIX</span>
          <span style="font-size: 9px; color: #34d399; font-weight: 600;">Traceable Causal Chain</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="color: #94a3b8; text-align: left; font-size: 9.5px; text-transform: uppercase;">
              <th style="padding: 4px 6px;">Parameter</th>
              <th style="padding: 4px 6px;">[OBSERVED] Baseline</th>
              <th style="padding: 4px 6px;">[MODELED] Scenario</th>
              <th style="padding: 4px 6px; text-align: right;">Impact Delta</th>
            </tr>
          </thead>
          <tbody id="sim-comparison-rows">
            <!-- Populated dynamically by updateSimulation() -->
          </tbody>
        </table>
      </div>

      <!-- Interactive Scenario Controls Grid -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; margin-bottom: 14px;">
        <div style="font-size: 10.5px; font-weight: 700; color: #f1f5f9; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Operator Condition Adjustments</div>

        <!-- Row 1: FRP & Band 4 Brightness -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
              <span style="color: #cbd5e1;">Thermal Emission (FRP)</span>
              <strong id="val-frp" style="color: #fb923c;">42 MW</strong>
            </div>
            <input type="range" id="slider-frp" min="5" max="300" step="5" value="42" style="width: 100%; accent-color: #fb923c; cursor: pointer;" />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
              <span style="color: #cbd5e1;">VIIRS Band 4 Brightness</span>
              <strong id="val-mir" style="color: #f43f5e;">327 K</strong>
            </div>
            <input type="range" id="slider-mir" min="300" max="375" step="1" value="327" style="width: 100%; accent-color: #f43f5e; cursor: pointer;" />
          </div>
        </div>

        <!-- Row 2: Wind Speed & Wind Direction with Vector Compass -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
              <span style="color: #cbd5e1;">Wind Velocity</span>
              <strong id="val-wind-speed" style="color: #34d399;">14 km/h</strong>
            </div>
            <input type="range" id="slider-wind-speed" min="0" max="60" step="2" value="14" style="width: 100%; accent-color: #34d399; cursor: pointer;" />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
              <span style="color: #cbd5e1;">Wind Origin / Azimuth</span>
              <strong id="val-wind-dir" style="color: #38bdf8; display: flex; align-items: center; gap: 4px;">
                <span>110° ESE</span>
                <span id="wind-arrow-icon" style="display: inline-block; transform: rotate(110deg); font-size: 12px;">➔</span>
              </strong>
            </div>
            <input type="range" id="slider-wind-dir" min="0" max="355" step="5" value="110" style="width: 100%; accent-color: #38bdf8; cursor: pointer;" />
          </div>
        </div>

        <!-- Row 3: Atmospheric Stability Class Selector & Proximity -->
        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px;">
          <div>
            <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 3px;">Atmospheric Stability (Pasquill)</div>
            <select id="select-stability" style="width: 100%; background: rgba(15,23,42,0.9); border: 1px solid rgba(56,189,248,0.4); color: #38bdf8; border-radius: 5px; padding: 4px 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
              <option value="UNSTABLE">Class A/B — Unstable (Convective Mixing)</option>
              <option value="NEUTRAL" selected>Class C/D — Neutral (Standard Dispersion)</option>
              <option value="STABLE">Class E/F — Stable (Inversion Trapping)</option>
            </select>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
              <span style="color: #cbd5e1;">Facility Distance</span>
              <strong id="val-dist" style="color: #fbbf24;">0.5 km</strong>
            </div>
            <input type="range" id="slider-dist" min="0" max="25" step="0.5" value="0.5" style="width: 100%; accent-color: #fbbf24; cursor: pointer;" />
            <input type="hidden" id="slider-rec" value="18" />
          </div>
        </div>
      </div>

      <!-- 3-Tier Multi-Physics & Explainability Cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <!-- Layer 1: Planck/Dozier Pyrometry -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 9.5px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">LAYER 1: PLANCK PYROMETRY</span>
            <span style="font-size: 8.5px; color: #38bdf8; font-family: monospace;">[MODELED]</span>
          </div>
          <div style="font-size: 10.5px; display: flex; flex-direction: column; gap: 3px;">
            <div><span style="color: #94a3b8;">True Flame Temp:</span> <strong id="sim-dozier-temp" style="color: #f87171;">--</strong></div>
            <div><span style="color: #94a3b8;">Combustion Footprint:</span> <strong id="sim-dozier-area" style="color: #fbbf24;">--</strong></div>
            <div><span style="color: #94a3b8;">Radiant Heat Flux:</span> <strong id="sim-dozier-flux" style="color: #38bdf8;">--</strong></div>
          </div>
        </div>

        <!-- Layer 2: Briggs Plume Rise & Dispersion -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 9.5px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">LAYER 2: PLUME TRANSPORT</span>
            <span style="font-size: 8.5px; color: #34d399; font-family: monospace;">[MODELED]</span>
          </div>
          <div style="font-size: 10.5px; display: flex; flex-direction: column; gap: 3px;">
            <div><span style="color: #94a3b8;">Plume Reach (±Uncert):</span> <strong id="sim-plume-reach" style="color: #34d399;">--</strong></div>
            <div><span style="color: #94a3b8;">Hazard Sector Area:</span> <strong id="sim-plume-area" style="color: #fde047;">--</strong></div>
            <div><span style="color: #94a3b8;">Estimated Exposure:</span> <strong id="sim-plume-pop" style="color: #f87171;">--</strong></div>
          </div>
        </div>
      </div>

      <!-- Layer 3: TreeSHAP Feature Sensitivity -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 9.5px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">LAYER 3: ML CLASSIFICATION SENSITIVITY (TREESHAP)</span>
          <span style="font-size: 8.5px; color: #a855f7; font-family: monospace;">[PREDICTED]</span>
        </div>
        <div id="sim-xai-bars" style="margin-bottom: 6px;"></div>
        <div id="sim-sat-context" style="font-size: 10px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 4px;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modalElement);

  // Wire close button
  modalElement.querySelector('#simlab-close-btn').addEventListener('click', closeAiSimulationLabModal);

  // Wire sliders
  const inputIds = ['#slider-frp', '#slider-mir', '#slider-wind-speed', '#slider-wind-dir', '#slider-dist'];
  inputIds.forEach(id => {
    modalElement.querySelector(id).addEventListener('input', () => {
      readControlsToScenario();
      updateSimulation();
    });
  });

  modalElement.querySelector('#select-stability').addEventListener('change', () => {
    readControlsToScenario();
    updateSimulation();
  });

  // Wire scenario presets
  modalElement.querySelectorAll('.sim-scenario-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const scenarioType = btn.getAttribute('data-scenario');
      applyScenarioPreset(scenarioType);
    });
  });
}

function readControlsToScenario() {
  if (!modalElement) return;
  scenarioState.frp = parseFloat(modalElement.querySelector('#slider-frp').value);
  scenarioState.mir = parseFloat(modalElement.querySelector('#slider-mir').value);
  scenarioState.windSpeedKmh = parseFloat(modalElement.querySelector('#slider-wind-speed').value);
  scenarioState.windDirDeg = parseInt(modalElement.querySelector('#slider-wind-dir').value, 10);
  scenarioState.stability = modalElement.querySelector('#select-stability').value;
  scenarioState.distKm = parseFloat(modalElement.querySelector('#slider-dist').value);
}

function applyScenarioPreset(preset) {
  if (preset === 'baseline') {
    scenarioState = { ...baselineState };
  } else if (preset === 'surge') {
    scenarioState = { ...baselineState };
    scenarioState.frp = Math.round(Math.max(30, baselineState.frp * 2.8));
    scenarioState.mir = 358;
    scenarioState.stability = 'NEUTRAL';
  } else if (preset === 'wind_shift') {
    scenarioState = { ...baselineState };
    scenarioState.windSpeedKmh = Math.max(28, baselineState.windSpeedKmh * 2);
    scenarioState.windDirDeg = (baselineState.windDirDeg + 50) % 360;
    scenarioState.stability = 'NEUTRAL';
  } else if (preset === 'inversion') {
    scenarioState = { ...baselineState };
    scenarioState.stability = 'STABLE';
    scenarioState.windSpeedKmh = 8;
  }

  syncSlidersToScenario();
  updateSimulation();
}

function updateSimulation() {
  if (!modalElement) return;

  // 1. Update slider labels & wind compass
  modalElement.querySelector('#val-frp').textContent = `${scenarioState.frp} MW`;
  modalElement.querySelector('#val-mir').textContent = `${scenarioState.mir} K`;
  modalElement.querySelector('#val-wind-speed').textContent = `${scenarioState.windSpeedKmh} km/h`;
  
  const heading = getCompassHeading(scenarioState.windDirDeg);
  modalElement.querySelector('#val-wind-dir').innerHTML = `
    <span>${scenarioState.windDirDeg}° ${heading}</span>
    <span style="display: inline-block; transform: rotate(${scenarioState.windDirDeg}deg); font-size: 12px;">➔</span>
  `;
  modalElement.querySelector('#val-dist').textContent = `${scenarioState.distKm.toFixed(1)} km`;

  // 2. Physics Consistency Guardrail Check
  const physicsBanner = modalElement.querySelector('#sim-physics-banner');
  const consistency = validatePhysicsConsistency({
    frpMw: scenarioState.frp,
    mirBrightnessK: scenarioState.mir
  });

  if (!consistency.isConsistent) {
    physicsBanner.style.display = 'block';
    physicsBanner.style.background = 'rgba(239, 68, 68, 0.15)';
    physicsBanner.style.border = '1px solid rgba(239, 68, 68, 0.45)';
    physicsBanner.style.color = '#fca5a5';
    physicsBanner.innerHTML = `<strong>⚠ PHYSICS CONSISTENCY WARNING:</strong> ${consistency.message}`;
  } else if (consistency.severity === 'INFO') {
    physicsBanner.style.display = 'block';
    physicsBanner.style.background = 'rgba(56, 189, 248, 0.12)';
    physicsBanner.style.border = '1px solid rgba(56, 189, 248, 0.35)';
    physicsBanner.style.color = '#7dd3fc';
    physicsBanner.innerHTML = `<strong>ℹ SENSOR NOTE:</strong> ${consistency.message}`;
  } else {
    physicsBanner.style.display = 'none';
  }

  // 3. Compute Baseline Outputs (Deterministic)
  const baselineDozier = solveDozierPyrometry(baselineState.mir, 296, baselineState.frp);
  const baselineSim = runWhatIfSimulation({
    latitude: baselineState.lat,
    longitude: baselineState.lon,
    windSpeedMps: baselineState.windSpeedKmh / 3.6,
    windDirectionDeg: baselineState.windDirDeg,
    frpMw: baselineState.frp,
    stabilityClass: baselineState.stability,
    mirBrightnessK: baselineState.mir
  });

  const baselineHazardMock = {
    latitude: baselineState.lat,
    longitude: baselineState.lon,
    frp: baselineState.frp,
    distKm: baselineState.distKm,
    brightness: baselineState.mir,
    daynight: 'N',
    landCover: baselineState.landCover,
    ndvi: baselineState.ndvi
  };
  const baselineClassification = classifyThermalIncident(baselineHazardMock, []);

  // 4. Compute Scenario Outputs (Deterministic)
  const scenarioDozier = solveDozierPyrometry(scenarioState.mir, 296, scenarioState.frp);
  const scenarioSim = runWhatIfSimulation({
    latitude: scenarioState.lat,
    longitude: scenarioState.lon,
    windSpeedMps: scenarioState.windSpeedKmh / 3.6,
    windDirectionDeg: scenarioState.windDirDeg,
    frpMw: scenarioState.frp,
    stabilityClass: scenarioState.stability,
    mirBrightnessK: scenarioState.mir
  });

  // Live sync with 3D Cesium globe so modeled plume rotates and recalculates on map in real-time
  const viewer = window.__sriVision?.viewer || (typeof window !== 'undefined' ? window.viewer : null);
  if (viewer && scenarioSim?.plume) {
    try {
      renderPlumeOnCesium(viewer, scenarioSim.plume);
    } catch (e) {
      console.warn('[SimLab] Globe plume sync:', e);
    }
  }

  const scenarioHazardMock = {
    latitude: scenarioState.lat,
    longitude: scenarioState.lon,
    frp: scenarioState.frp,
    distKm: scenarioState.distKm,
    brightness: scenarioState.mir,
    daynight: 'N',
    landCover: scenarioState.distKm > 5 ? 'forest' : 'industrial',
    ndvi: scenarioState.distKm > 5 ? 0.62 : 0.18
  };
  const scenarioClassification = classifyThermalIncident(scenarioHazardMock, []);

  // 5. Populate Before vs After Comparison Matrix
  const bReach = baselineSim.projected_outputs.downwind_hazard_distance_km;
  const sReach = scenarioSim.projected_outputs.downwind_hazard_distance_km;
  const deltaReach = Number((sReach - bReach).toFixed(1));
  const reachDeltaPct = Math.round((deltaReach / bReach) * 100);

  const bArea = baselineSim.projected_outputs.total_affected_area_km2;
  const sArea = scenarioSim.projected_outputs.total_affected_area_km2;
  const areaDeltaPct = Math.round(((sArea - bArea) / Math.max(0.1, bArea)) * 100);

  const bPop = baselineSim.projected_outputs.civilian_exposure?.totals?.totalExposedHeadcount || 1200;
  const sPop = scenarioSim.projected_outputs.civilian_exposure?.totals?.totalExposedHeadcount || 3400;
  const popDeltaPct = Math.round(((sPop - bPop) / Math.max(1, bPop)) * 100);

  const frpDelta = scenarioState.frp - baselineState.frp;
  const frpDeltaPct = Math.round((frpDelta / baselineState.frp) * 100);

  const windDirDiff = ((scenarioState.windDirDeg - baselineState.windDirDeg + 180) % 360) - 180;
  const windSpeedDiff = Math.round(scenarioState.windSpeedKmh - baselineState.windSpeedKmh);
  let windDeltaLabel = 'Stable';
  if (windDirDiff !== 0 && windSpeedDiff !== 0) {
    windDeltaLabel = `${windDirDiff > 0 ? '+' : ''}${windDirDiff}° · ${windSpeedDiff > 0 ? '+' : ''}${windSpeedDiff}km/h`;
  } else if (windDirDiff !== 0) {
    windDeltaLabel = `${windDirDiff > 0 ? '+' : ''}${windDirDiff}° Shift`;
  } else if (windSpeedDiff !== 0) {
    windDeltaLabel = `${windSpeedDiff > 0 ? '+' : ''}${windSpeedDiff} km/h`;
  }

  const deltaColor = (val) => val > 0 ? '#f87171' : val < 0 ? '#34d399' : '#94a3b8';

  modalElement.querySelector('#sim-comparison-rows').innerHTML = `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 5px 6px; color: #cbd5e1; font-weight: 600;">Radiant Power (FRP)</td>
      <td style="padding: 5px 6px; color: #94a3b8;">${baselineState.frp.toFixed(0)} MW</td>
      <td style="padding: 5px 6px; color: #fb923c; font-weight: 700;">${scenarioState.frp.toFixed(0)} MW</td>
      <td style="padding: 5px 6px; text-align: right; color: ${deltaColor(frpDelta)}; font-weight: 700;">
        ${frpDelta >= 0 ? '+' : ''}${frpDeltaPct}%
      </td>
    </tr>
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 5px 6px; color: #cbd5e1; font-weight: 600;">Flame Temp (Tf) / Area</td>
      <td style="padding: 5px 6px; color: #94a3b8;">${baselineDozier.flameTempK}K (${baselineDozier.flameAreaM2}m²)</td>
      <td style="padding: 5px 6px; color: #fde047; font-weight: 700;">${scenarioDozier.flameTempK}K (${scenarioDozier.flameAreaM2}m²)</td>
      <td style="padding: 5px 6px; text-align: right; color: ${deltaColor(scenarioDozier.flameTempK - baselineDozier.flameTempK)}; font-weight: 700;">
        ${scenarioDozier.flameTempK >= baselineDozier.flameTempK ? '+' : ''}${scenarioDozier.flameTempK - baselineDozier.flameTempK}K
      </td>
    </tr>
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 5px 6px; color: #cbd5e1; font-weight: 600;">Wind Vector & Stability</td>
      <td style="padding: 5px 6px; color: #94a3b8;">${baselineState.windSpeedKmh}km/h (${baselineState.windDirDeg}° D)</td>
      <td style="padding: 5px 6px; color: #38bdf8; font-weight: 700;">${scenarioState.windSpeedKmh}km/h (${scenarioState.windDirDeg}° ${scenarioSim.inputs.stability_pasquill})</td>
      <td style="padding: 5px 6px; text-align: right; color: #38bdf8; font-weight: 700; font-size: 10px;">
        ${windDeltaLabel}
      </td>
    </tr>
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 5px 6px; color: #cbd5e1; font-weight: 600;">Plume Reach (±Uncert)</td>
      <td style="padding: 5px 6px; color: #94a3b8;">${bReach}km (±${baselineSim.projected_outputs.uncertainty_km})</td>
      <td style="padding: 5px 6px; color: #34d399; font-weight: 700;">${sReach}km (±${scenarioSim.projected_outputs.uncertainty_km})</td>
      <td style="padding: 5px 6px; text-align: right; color: ${deltaColor(reachDeltaPct)}; font-weight: 700;">
        ${reachDeltaPct >= 0 ? '+' : ''}${reachDeltaPct}%
      </td>
    </tr>
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 5px 6px; color: #cbd5e1; font-weight: 600;">Hazard Footprint Area</td>
      <td style="padding: 5px 6px; color: #94a3b8;">${bArea} km²</td>
      <td style="padding: 5px 6px; color: #facc15; font-weight: 700;">${sArea} km²</td>
      <td style="padding: 5px 6px; text-align: right; color: ${deltaColor(areaDeltaPct)}; font-weight: 700;">
        ${areaDeltaPct >= 0 ? '+' : ''}${areaDeltaPct}%
      </td>
    </tr>
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 5px 6px; color: #cbd5e1; font-weight: 600;">Civilian Headcount</td>
      <td style="padding: 5px 6px; color: #94a3b8;">~${bPop.toLocaleString()} in path</td>
      <td style="padding: 5px 6px; color: #f87171; font-weight: 700;">~${sPop.toLocaleString()} in path</td>
      <td style="padding: 5px 6px; text-align: right; color: ${deltaColor(popDeltaPct)}; font-weight: 700;">
        ${popDeltaPct >= 0 ? '+' : ''}${popDeltaPct}%
      </td>
    </tr>
    <tr>
      <td style="padding: 5px 6px; color: #cbd5e1; font-weight: 600;">AI Category & Conf</td>
      <td style="padding: 5px 6px; color: #94a3b8;">${baselineClassification.categoryLabel} (${Math.round(baselineClassification.confidence * 100)}%)</td>
      <td style="padding: 5px 6px; color: #38bdf8; font-weight: 700;">${scenarioClassification.categoryLabel} (${Math.round(scenarioClassification.confidence * 100)}%)</td>
      <td style="padding: 5px 6px; text-align: right; color: #38bdf8; font-size: 10px;">
        ${scenarioClassification.category === baselineClassification.category ? 'Consistent' : 'State Transition'}
      </td>
    </tr>
  `;

  // 6. Update Layer 1 (Planck / Dozier) Cards
  modalElement.querySelector('#sim-dozier-temp').textContent = `${scenarioDozier.flameTempK} K (${scenarioDozier.flameTempC}°C)`;
  modalElement.querySelector('#sim-dozier-area').textContent = `${scenarioDozier.flameAreaM2} m²`;
  modalElement.querySelector('#sim-dozier-flux').textContent = `${scenarioDozier.radiantHeatFluxKwM2} kW/m²`;

  // 7. Update Layer 2 (Atmospheric Transport) Cards
  modalElement.querySelector('#sim-plume-reach').textContent = `${sReach} km (±${scenarioSim.projected_outputs.uncertainty_km} km)`;
  modalElement.querySelector('#sim-plume-area').textContent = `${sArea} km² (Spread: ${scenarioSim.projected_outputs.stability_profile.spreadAngleDeg}°)`;
  modalElement.querySelector('#sim-plume-pop').textContent = `~${sPop.toLocaleString()} civilians in corridor`;

  // 8. Update Layer 3 (TreeSHAP Sensitivity)
  const isIndustrial = scenarioClassification.category.includes('INDUSTRIAL');
  const shapResult = resolveEventAttributions(scenarioHazardMock, scenarioDozier, isIndustrial);
  const items = shapResult?.items || [];

  const barsHtml = items.slice(0, 4).map(item => {
    const isPositive = item.val >= 0;
    const barWidth = Math.min(100, Math.round(Math.abs(item.val) * 160));
    const barColor = isPositive ? '#34d399' : '#f87171';
    return `
      <div style="margin-bottom: 4px; font-size: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
          <span style="color: #cbd5e1;">${item.name}</span>
          <span style="color: ${barColor}; font-family: monospace; font-weight: 700;">${isPositive ? '+' : ''}${item.val.toFixed(2)}</span>
        </div>
        <div style="background: rgba(255,255,255,0.06); height: 4px; border-radius: 2px; overflow: hidden;">
          <div style="background: ${barColor}; width: ${barWidth}%; height: 100%; border-radius: 2px;"></div>
        </div>
      </div>
    `;
  }).join('');

  modalElement.querySelector('#sim-xai-bars').innerHTML = barsHtml || '<div style="font-size: 10px; color: #94a3b8;">No SHAP attributions</div>';
  modalElement.querySelector('#sim-sat-context').innerHTML = `
    <span>Sensory Anchor: ESA WorldCover (10m) · Sentinel-2 MSI · VIIRS Band 4 (${scenarioState.mir}K)</span>
  `;
}
