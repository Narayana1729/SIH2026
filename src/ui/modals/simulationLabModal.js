/**
 * @module src/ui/modals/simulationLabModal
 * @description Interactive What-If Incident Simulation Lab Floating HUD Panel.
 *
 * Designed as a non-blocking, compact, draggable tactical HUD panel:
 *   - Does NOT cover the 3D globe or map controls with an opaque backdrop.
 *   - Live real-time parameter tuning: as sliders (wind, direction, FRP) move,
 *     the Gaussian dispersion plume rotates, expands, and renders directly
 *     on the Cesium 3D terrain in real-time.
 *   - Draggable header to reposition anywhere on screen.
 *   - Minimize / Expand toggle to shrink to a tiny status bar pill.
 *   - Clear demarcation as SIMULATED SCENARIO.
 */

import { runWhatIfSimulation, SCENARIO_MODES } from '../../simulation/incidentSimulationLab.js';
import { renderPlumeOnCesium } from '../../disasters/dispersion/gaussianPlume.js';

let modalContainer = null;
let currentIncident = null;
let viewerRef = null;
let onProjectCallback = null;
let isMinimized = false;

/**
 * Open the What-If Incident Simulation Lab floating panel.
 * @param {Object} incident Incident context
 * @param {Object} [options]
 * @param {Cesium.Viewer} [options.viewer]
 * @param {Function} [options.onProjectToGlobe] Callback when operator projects simulated plume
 */
export function openSimulationLabModal(incident, options = {}) {
  currentIncident = incident;
  viewerRef = options.viewer || (typeof window !== 'undefined' ? window.__sriVision?.viewer : null);
  onProjectCallback = options.onProjectToGlobe || null;

  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'sri-sim-lab-modal';
    // Pointer-events: none on container ensures 3D canvas and HUD remain 100% interactive
    modalContainer.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      pointer-events: none;
      z-index: 9500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f1f5f9;
    `;
    document.body.appendChild(modalContainer);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalContainer && modalContainer.style.display !== 'none') {
        closeSimulationLabModal();
      }
    });
  }

  isMinimized = false;
  renderModal();
  modalContainer.style.display = 'block';

  // Smoothly position camera over incident with a tactical oblique perspective
  focusIncidentCamera();
}

export function closeSimulationLabModal() {
  if (modalContainer) {
    modalContainer.style.display = 'none';
  }
}

function focusIncidentCamera() {
  if (!currentIncident) return;
  const lat = Number(currentIncident.location?.latitude ?? currentIncident.latitude ?? 22.45);
  const lon = Number(currentIncident.location?.longitude ?? currentIncident.longitude ?? 70.05);
  const viewer = viewerRef || (typeof window !== 'undefined' ? window.__sriVision?.viewer : null);

  if (viewer?.camera && Number.isFinite(lat) && Number.isFinite(lon)) {
    const C = typeof Cesium !== 'undefined' ? Cesium : window.Cesium;
    if (C) {
      viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(lon, lat - 0.04, 18000),
        orientation: {
          heading: 0,
          pitch: C.Math.toRadians(-55),
          roll: 0,
        },
        duration: 1.4,
      });
    }
  }
}

function renderModal() {
  if (!currentIncident || !modalContainer) return;

  const lat = Number(currentIncident.location?.latitude ?? currentIncident.latitude ?? 22.45);
  const lon = Number(currentIncident.location?.longitude ?? currentIncident.longitude ?? 70.05);
  const baseFrp = Number(currentIncident.frp ?? currentIncident.intensity?.mean_frp_mw ?? 50.0);
  const baseWindMps = Number(currentIncident.weather?.windSpeedKmh ? (currentIncident.weather.windSpeedKmh / 3.6).toFixed(1) : 5.0);
  const baseWindDir = Number(currentIncident.weather?.windDirectionDeg ?? 240);
  const incidentTitle = currentIncident.title || currentIncident.facility?.name || 'Target Incident';

  modalContainer.innerHTML = `
    <div id="sri-sim-panel-card" style="
      position: absolute;
      top: 76px;
      right: 20px;
      width: 440px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 96px);
      background: linear-gradient(165deg, rgba(15, 23, 42, 0.96) 0%, rgba(9, 14, 23, 0.98) 100%);
      border: 1px solid rgba(245, 158, 11, 0.45);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 25px rgba(245, 158, 11, 0.15);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
      transition: width 0.2s ease, max-height 0.2s ease;
    ">
      <!-- Draggable Header Bar -->
      <div id="sri-sim-drag-header" style="
        padding: 10px 14px;
        background: linear-gradient(90deg, rgba(69, 26, 3, 0.9), rgba(15, 23, 42, 0.95));
        border-bottom: 1px solid rgba(245, 158, 11, 0.3);
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
        user-select: none;
      ">
        <div style="display: flex; align-items: center; gap: 9px; min-width: 0;">
          <div style="
            width: 28px; height: 28px; flex-shrink: 0;
            background: rgba(245, 158, 11, 0.2);
            border: 1px solid rgba(245, 158, 11, 0.5);
            border-radius: 7px;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px;
          ">
            🧪
          </div>
          <div style="min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <h2 style="margin: 0; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #fbbf24; white-space: nowrap;">
                SIMULATION LAB
              </h2>
              <span style="
                padding: 1px 5px; font-size: 8.5px; font-weight: 800; letter-spacing: 0.5px;
                background: rgba(245, 158, 11, 0.2); color: #fde68a;
                border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 3px;
                white-space: nowrap;
              ">
                SIMULATED
              </span>
            </div>
            <div style="font-size: 10px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${incidentTitle} (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <button id="sri-sim-focus-btn" type="button" title="Center camera on incident in 3D" style="
            padding: 4px 8px; border-radius: 6px;
            background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35);
            color: #38bdf8; font-size: 10px; font-weight: 700; cursor: pointer;
            display: flex; align-items: center; gap: 4px;
          ">
            <span>🎯</span><span>Focus</span>
          </button>
          <button id="sri-sim-min-btn" type="button" title="Minimize / Expand panel" style="
            width: 26px; height: 26px; border-radius: 6px;
            background: #1e293b; border: 1px solid #334155;
            color: #cbd5e1; font-size: 13px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          ">${isMinimized ? '⤢' : '━'}</button>
          <button id="sri-sim-close-btn" type="button" title="Close Simulation Lab" style="
            width: 26px; height: 26px; border-radius: 6px;
            background: #1e293b; border: 1px solid #334155;
            color: #ef4444; font-size: 13px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          ">✕</button>
        </div>
      </div>

      <!-- Minimized Strip (shown when isMinimized = true) -->
      <div id="sri-sim-min-bar" style="
        display: ${isMinimized ? 'flex' : 'none'};
        padding: 8px 14px;
        align-items: center;
        justify-content: space-between;
        background: rgba(15, 23, 42, 0.95);
        font-size: 11px;
      ">
        <span style="color: #38bdf8; font-weight: 700;" id="sri-min-summary">
          Plume: --- · --- km
        </span>
        <span style="color: #34d399; font-size: 9px; font-family: monospace; font-weight: 700;">
          🟢 LIVE 3D SYNC
        </span>
      </div>

      <!-- Main Expandable Body -->
      <div id="sri-sim-body" style="
        display: ${isMinimized ? 'none' : 'flex'};
        flex-direction: column;
        overflow-y: auto;
        padding: 12px 14px;
        gap: 12px;
      ">
        <!-- Live Sync Status Banner -->
        <div style="
          padding: 6px 10px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 6px;
          font-size: 10px; color: #a7f3d0;
          display: flex; align-items: center; justify-content: space-between;
        ">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
            <span><strong>Live 3D Map Sync:</strong> Plume updates on terrain as you slide</span>
          </div>
          <span style="font-size: 8.5px; opacity: 0.8; letter-spacing: 0.4px;">REALTIME</span>
        </div>

        <!-- Metric Output Cards (2x2 Grid) -->
        <div style="
          background: rgba(2, 6, 23, 0.7);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 8px;
          padding: 10px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px;">
            <span>Projected Dispersion Metrics</span>
            <span style="color: #34d399; font-family: monospace;">GAUSSIAN ATM</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: rgba(15, 23, 42, 0.85); padding: 7px 9px; border-radius: 6px; border: 1px solid #1e293b;">
              <div style="font-size: 8.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Downwind Plume Axis</div>
              <div style="font-size: 14px; font-weight: 800; color: #38bdf8; font-family: monospace; margin-top: 2px;" id="sri-out-heading">---</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.85); padding: 7px 9px; border-radius: 6px; border: 1px solid #1e293b;">
              <div style="font-size: 8.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Hazard Horizon</div>
              <div style="font-size: 14px; font-weight: 800; color: #fbbf24; font-family: monospace; margin-top: 2px;" id="sri-out-distance">---</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.85); padding: 7px 9px; border-radius: 6px; border: 1px solid #1e293b;">
              <div style="font-size: 8.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Affected Area</div>
              <div style="font-size: 14px; font-weight: 800; color: #ef4444; font-family: monospace; margin-top: 2px;" id="sri-out-area">---</div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.85); padding: 7px 9px; border-radius: 6px; border: 1px solid #1e293b;">
              <div style="font-size: 8.5px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Evacuation Cordon</div>
              <div style="font-size: 14px; font-weight: 800; color: #facc15; font-family: monospace; margin-top: 2px;" id="sri-out-cordon">---</div>
            </div>
          </div>
        </div>

        <!-- Scenario Mode Presets (2x2 Grid) -->
        <div>
          <label style="display: block; font-size: 9.5px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px;">
            Disaster Scenario Mode
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;" id="sri-scenario-modes">
            ${Object.values(SCENARIO_MODES).map((mode, idx) => `
              <button type="button" data-mode="${mode.id}" class="sri-mode-btn" style="
                text-align: left; padding: 7px 9px; border-radius: 6px; font-size: 10px; cursor: pointer;
                background: ${idx === 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.5)'};
                border: 1px solid ${idx === 0 ? '#f59e0b' : '#334155'};
                color: ${idx === 0 ? '#fef3c7' : '#cbd5e1'};
                transition: all 0.15s ease;
              ">
                <div style="font-weight: 700; line-height: 1.2;">${mode.name}</div>
                <div style="font-size: 8px; color: #94a3b8; margin-top: 2px; line-height: 1.1; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${mode.description}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Slider 1: Wind Velocity -->
        <div style="background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 7px; padding: 9px 11px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; margin-bottom: 4px;">
            <span style="font-weight: 700; color: #cbd5e1;">Wind Velocity</span>
            <span style="font-family: monospace; font-weight: 700; color: #fbbf24;" id="sri-sim-windspeed-val">${baseWindMps} m/s (${(baseWindMps * 3.6).toFixed(1)} km/h)</span>
          </div>
          <input type="range" id="sri-sim-windspeed-slider" min="0.5" max="35" step="0.5" value="${baseWindMps}" style="width: 100%; accent-color: #f59e0b; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; margin-top: 2px;">
            <span>Light Air (0.5 m/s)</span>
            <span>Moderate (10 m/s)</span>
            <span>Gale (35 m/s)</span>
          </div>
        </div>

        <!-- Slider 2: Wind Origin Azimuth -->
        <div style="background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 7px; padding: 9px 11px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; margin-bottom: 4px;">
            <span style="font-weight: 700; color: #cbd5e1;">Wind Origin Azimuth</span>
            <span style="font-family: monospace; font-weight: 700; color: #38bdf8;" id="sri-sim-winddir-val">${baseWindDir}° (Dispersal: ${(baseWindDir + 180) % 360}°)</span>
          </div>
          <input type="range" id="sri-sim-winddir-slider" min="0" max="360" step="5" value="${baseWindDir}" style="width: 100%; accent-color: #38bdf8; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; margin-top: 2px;">
            <span>0° (N)</span>
            <span>90° (E)</span>
            <span>180° (S)</span>
            <span>270° (W)</span>
            <span>360° (N)</span>
          </div>
        </div>

        <!-- Slider 3: Fire Radiative Power (FRP) -->
        <div style="background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 7px; padding: 9px 11px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; margin-bottom: 4px;">
            <span style="font-weight: 700; color: #cbd5e1;">Thermal Output (FRP)</span>
            <span style="font-family: monospace; font-weight: 700; color: #ef4444;" id="sri-sim-frp-val">${baseFrp.toFixed(1)} MW</span>
          </div>
          <input type="range" id="sri-sim-frp-slider" min="5" max="300" step="5" value="${baseFrp}" style="width: 100%; accent-color: #ef4444; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; margin-top: 2px;">
            <span>5 MW (Routine)</span>
            <span>100 MW (Flare)</span>
            <span>300 MW (Surge)</span>
          </div>
        </div>

        <!-- Critical Assets & Sanctuary Summary -->
        <div style="
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 7px;
          padding: 8px 10px;
          font-size: 10px;
        ">
          <div style="font-weight: 700; color: #cbd5e1; margin-bottom: 4px; display: flex; justify-content: space-between;">
            <span>Infrastructure & Ecology Impact:</span>
            <span id="sri-sim-infra-count" style="color: #fbbf24; font-family: monospace;">0 Assets</span>
          </div>
          <div id="sri-sim-infra-list" style="max-height: 65px; overflow-y: auto; font-size: 9.5px; display: flex; flex-direction: column; gap: 3px;">
            <!-- Dynamically populated -->
          </div>
          <div id="sri-sim-sanctuary" style="margin-top: 6px; padding-top: 4px; border-top: 1px solid rgba(51, 65, 85, 0.4); color: #94a3b8; font-size: 9.5px;">
            <!-- Dynamically populated -->
          </div>
        </div>

        <!-- Epistemic Notice -->
        <div style="
          font-size: 9px; color: #d97706; line-height: 1.3;
          display: flex; align-items: flex-start; gap: 6px;
          padding: 4px 6px; background: rgba(217, 119, 6, 0.08); border-radius: 4px;
        ">
          <span>⚠️</span>
          <span>Simulation is an operator-controlled hypothetical model. Not an observed satellite detection.</span>
        </div>

        <!-- Action Button -->
        <button id="sri-sim-project-globe-btn" type="button" style="
          width: 100%; padding: 9px 12px;
          background: linear-gradient(90deg, #d97706, #f59e0b);
          border: 1px solid #fbbf24; border-radius: 7px;
          color: #030712; font-weight: 800; font-size: 11px;
          letter-spacing: 0.4px; text-transform: uppercase;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
        ">
          <span>🌐</span>
          <span>Lock & Re-Center 3D Plume</span>
        </button>
      </div>
    </div>
  `;

  // Attach interactive listeners
  let selectedMode = 'BASELINE';
  const panelCard = document.getElementById('sri-sim-panel-card');
  const speedSlider = document.getElementById('sri-sim-windspeed-slider');
  const dirSlider = document.getElementById('sri-sim-winddir-slider');
  const frpSlider = document.getElementById('sri-sim-frp-slider');

  const speedVal = document.getElementById('sri-sim-windspeed-val');
  const dirVal = document.getElementById('sri-sim-winddir-val');
  const frpVal = document.getElementById('sri-sim-frp-val');

  const outHeading = document.getElementById('sri-out-heading');
  const outDistance = document.getElementById('sri-out-distance');
  const outArea = document.getElementById('sri-out-area');
  const outCordon = document.getElementById('sri-out-cordon');
  const infraList = document.getElementById('sri-sim-infra-list');
  const infraCount = document.getElementById('sri-sim-infra-count');
  const sanctuaryBox = document.getElementById('sri-sim-sanctuary');
  const minSummary = document.getElementById('sri-min-summary');

  let currentSimPayload = null;

  const updateSimulation = () => {
    const ws = Number(speedSlider.value);
    const wd = Number(dirSlider.value);
    const frp = Number(frpSlider.value);

    speedVal.textContent = `${ws.toFixed(1)} m/s (${(ws * 3.6).toFixed(1)} km/h)`;
    dirVal.textContent = `${wd}° (Dispersal: ${(wd + 180) % 360}°)`;
    frpVal.textContent = `${frp.toFixed(1)} MW`;

    const sim = runWhatIfSimulation({
      latitude: lat,
      longitude: lon,
      windSpeedMps: ws,
      windDirectionDeg: wd,
      frpMw: frp,
      scenarioMode: selectedMode,
      chemicalName: currentIncident.facility?.sector ? 'Toxic Industrial Vapor' : 'Wildfire Particulate PM2.5',
    });
    currentSimPayload = sim;

    const headingDeg = sim.projected_outputs.plume_centerline_azimuth_deg;
    const hazardDistKm = sim.projected_outputs.downwind_hazard_distance_km.toFixed(1);

    outHeading.textContent = `${headingDeg}°`;
    outDistance.textContent = `${hazardDistKm} km`;
    outArea.textContent = `${sim.projected_outputs.total_affected_area_km2.toFixed(1)} km²`;
    outCordon.textContent = `${sim.projected_outputs.evacuation_recommendation_m} m`;

    if (minSummary) {
      minSummary.textContent = `Plume: ${headingDeg}° Axis · ${hazardDistKm} km Radius`;
    }

    // Render infra list
    const assets = sim.infrastructure_intersections.all_nearby || [];
    if (infraCount) {
      infraCount.textContent = `${assets.length} Assets`;
    }
    if (assets.length === 0) {
      infraList.innerHTML = '<div style="color: #64748b; font-style: italic;">No critical infrastructure within plume zone.</div>';
    } else {
      infraList.innerHTML = assets.slice(0, 5).map((a) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0;">
          <span style="color: #cbd5e1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${a.asset_name}</span>
          <span style="
            font-size: 8.5px; font-family: monospace; padding: 1px 4px; border-radius: 3px;
            ${a.threat_state === 'POTENTIALLY_AFFECTED' ? 'background: rgba(127, 29, 29, 0.8); color: #fca5a5;' : 'background: #1e293b; color: #94a3b8;'}
          ">
            ${a.distance_km} km
          </span>
        </div>
      `).join('');
    }

    // Render sanctuary
    const sanct = sim.protected_area_threat.nearest_sanctuary;
    if (sanct) {
      sanctuaryBox.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: #e2e8f0; font-weight: 600;">${sanct.short_name || sanct.name}</span>
          <span style="padding: 1px 5px; border-radius: 3px; font-size: 8.5px; font-weight: 700; background-color: ${sanct.threat_color}25; color: ${sanct.threat_color};">
            ${sanct.distance_km} km [${sanct.threat_level}]
          </span>
        </div>
      `;
    } else {
      sanctuaryBox.innerHTML = '<div style="color: #64748b; font-style: italic;">Outside configured ecological sanctuary zone.</div>';
    }

    // Live real-time update on Cesium 3D Globe:
    const viewer = viewerRef || (typeof window !== 'undefined' ? window.__sriVision?.viewer : null);
    if (viewer && sim.plume) {
      renderPlumeOnCesium(viewer, sim.plume);
      viewer.scene?.requestRender?.();
    }
  };

  // Attach real-time slider input events
  speedSlider?.addEventListener('input', updateSimulation);
  dirSlider?.addEventListener('input', updateSimulation);
  frpSlider?.addEventListener('input', updateSimulation);

  // Mode buttons
  const modeButtons = modalContainer.querySelectorAll('.sri-mode-btn');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMode = btn.getAttribute('data-mode');
      modeButtons.forEach((b) => {
        b.style.background = 'rgba(30, 41, 59, 0.5)';
        b.style.borderColor = '#334155';
        b.style.color = '#cbd5e1';
      });
      btn.style.background = 'rgba(245, 158, 11, 0.2)';
      btn.style.borderColor = '#f59e0b';
      btn.style.color = '#fef3c7';
      updateSimulation();
    });
  });

  // Minimize / Expand button
  const minBtn = document.getElementById('sri-sim-min-btn');
  const simBody = document.getElementById('sri-sim-body');
  const minBar = document.getElementById('sri-sim-min-bar');
  minBtn?.addEventListener('click', () => {
    isMinimized = !isMinimized;
    if (simBody) simBody.style.display = isMinimized ? 'none' : 'flex';
    if (minBar) minBar.style.display = isMinimized ? 'flex' : 'none';
    if (minBtn) minBtn.textContent = isMinimized ? '⤢' : '━';
  });

  // Focus Map Button
  document.getElementById('sri-sim-focus-btn')?.addEventListener('click', focusIncidentCamera);

  // Lock & Focus Button
  document.getElementById('sri-sim-project-globe-btn')?.addEventListener('click', () => {
    focusIncidentCamera();
    if (onProjectCallback && currentSimPayload) {
      onProjectCallback(currentSimPayload);
    }
  });

  // Close button
  document.getElementById('sri-sim-close-btn')?.addEventListener('click', closeSimulationLabModal);

  // Draggable window logic via header
  const dragHeader = document.getElementById('sri-sim-drag-header');
  if (dragHeader && panelCard) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    dragHeader.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      isDragging = true;
      dragHeader.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      const rect = panelCard.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      panelCard.style.right = 'auto';
      panelCard.style.bottom = 'auto';
      panelCard.style.left = `${startLeft}px`;
      panelCard.style.top = `${startTop}px`;

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - panelCard.offsetWidth - 10, startLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - 60, startTop + dy));
        panelCard.style.left = `${newLeft}px`;
        panelCard.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        dragHeader.style.cursor = 'grab';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // Initial calculation & immediate projection on the 3D map
  updateSimulation();
}
