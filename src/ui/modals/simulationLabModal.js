/**
 * @module src/ui/modals/simulationLabModal
 * @description Interactive What-If Incident Simulation Lab UI Modal.
 *
 * Allows tactical operators to adjust wind speed, direction, thermal intensity,
 * and industrial disaster scenarios, dynamically computing dispersion perimeters,
 * affected areas, and infrastructure intersections in real time.
 *
 * Invariant: Prominently demarcated as SIMULATED SCENARIO.
 */

import { runWhatIfSimulation, SCENARIO_MODES } from '../../simulation/incidentSimulationLab.js';

let modalContainer = null;
let currentIncident = null;
let viewerRef = null;
let onProjectCallback = null;

/**
 * Open the What-If Incident Simulation Lab modal.
 * @param {Object} incident Incident context
 * @param {Object} [options]
 * @param {Cesium.Viewer} [options.viewer]
 * @param {Function} [options.onProjectToGlobe] Callback when operator projects simulated plume
 */
export function openSimulationLabModal(incident, options = {}) {
  currentIncident = incident;
  viewerRef = options.viewer || null;
  onProjectCallback = options.onProjectToGlobe || null;

  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'sri-sim-lab-modal';
    modalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-200';
    document.body.appendChild(modalContainer);
  }

  renderModal();
  modalContainer.classList.remove('hidden');
}

export function closeSimulationLabModal() {
  if (modalContainer) {
    modalContainer.classList.add('hidden');
  }
}

function renderModal() {
  if (!currentIncident || !modalContainer) return;

  const lat = Number(currentIncident.location?.latitude ?? currentIncident.latitude ?? 22.45);
  const lon = Number(currentIncident.location?.longitude ?? currentIncident.longitude ?? 70.05);
  const baseFrp = Number(currentIncident.frp ?? currentIncident.intensity?.mean_frp_mw ?? 50.0);
  const baseWindMps = Number(currentIncident.weather?.windSpeedKmh ? (currentIncident.weather.windSpeedKmh / 3.6).toFixed(1) : 5.0);
  const baseWindDir = Number(currentIncident.weather?.windDirectionDeg ?? 240);

  modalContainer.innerHTML = `
    <div class="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 font-sans">
      <!-- Header Banner -->
      <div class="px-6 py-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg font-bold">
            🧪
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-base font-bold tracking-wide uppercase text-amber-400">Incident Simulation Lab</h2>
              <span class="px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                SIMULATED SCENARIO
              </span>
            </div>
            <p class="text-xs text-slate-400">Interactive physics scenario modeling for <span class="text-slate-200 font-semibold">${currentIncident.title || currentIncident.facility?.name || 'Target Incident'}</span></p>
          </div>
        </div>
        <button id="sri-sim-close-btn" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
          ✕
        </button>
      </div>

      <!-- Epistemic Notice -->
      <div class="px-6 py-2 bg-amber-950/40 border-b border-amber-500/20 text-[11px] text-amber-300/90 flex items-center space-x-2">
        <span>⚠️</span>
        <span><strong>Scientific Epistemic Notice:</strong> Outputs are operator-controlled hypothetical simulations. Never present or record as observed satellite measurements.</span>
      </div>

      <!-- Modal Body (Two-Column Layout) -->
      <div class="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        <!-- Left: Interactive Sliders & Scenario Controls (7 Cols) -->
        <div class="md:col-span-7 space-y-5">
          <!-- Scenario Presets -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Disaster Scenario Mode</label>
            <div class="grid grid-cols-2 gap-2" id="sri-scenario-modes">
              ${Object.values(SCENARIO_MODES).map((mode, idx) => `
                <button type="button" data-mode="${mode.id}" class="sri-mode-btn text-left p-2.5 rounded-lg border text-xs transition-all ${idx === 0 ? 'bg-amber-500/20 border-amber-500 text-amber-200' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'}">
                  <div class="font-bold">${mode.name}</div>
                  <div class="text-[10px] text-slate-400 line-clamp-1 mt-0.5">${mode.description}</div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Slider 1: Wind Speed -->
          <div class="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3.5 space-y-2">
            <div class="flex justify-between items-center text-xs">
              <span class="font-bold text-slate-300">Wind Velocity</span>
              <span class="font-mono font-bold text-amber-400" id="sri-sim-windspeed-val">${baseWindMps} m/s (${(baseWindMps * 3.6).toFixed(1)} km/h)</span>
            </div>
            <input type="range" id="sri-sim-windspeed-slider" min="0.5" max="35" step="0.5" value="${baseWindMps}" class="w-full accent-amber-500 bg-slate-700 h-1.5 rounded-lg cursor-pointer">
            <div class="flex justify-between text-[10px] text-slate-500">
              <span>Light Air (0.5 m/s)</span>
              <span>Moderate (10 m/s)</span>
              <span>Gale Force (35 m/s)</span>
            </div>
          </div>

          <!-- Slider 2: Wind Direction -->
          <div class="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3.5 space-y-2">
            <div class="flex justify-between items-center text-xs">
              <span class="font-bold text-slate-300">Wind Origin Azimuth</span>
              <span class="font-mono font-bold text-cyan-400" id="sri-sim-winddir-val">${baseWindDir}° (Dispersal: ${(baseWindDir + 180) % 360}°)</span>
            </div>
            <input type="range" id="sri-sim-winddir-slider" min="0" max="360" step="5" value="${baseWindDir}" class="w-full accent-cyan-500 bg-slate-700 h-1.5 rounded-lg cursor-pointer">
            <div class="flex justify-between text-[10px] text-slate-500">
              <span>0° (N)</span>
              <span>90° (E)</span>
              <span>180° (S)</span>
              <span>270° (W)</span>
              <span>360° (N)</span>
            </div>
          </div>

          <!-- Slider 3: Fire Radiative Power (FRP) -->
          <div class="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3.5 space-y-2">
            <div class="flex justify-between items-center text-xs">
              <span class="font-bold text-slate-300">Thermal Output (FRP)</span>
              <span class="font-mono font-bold text-red-400" id="sri-sim-frp-val">${baseFrp.toFixed(1)} MW</span>
            </div>
            <input type="range" id="sri-sim-frp-slider" min="5" max="300" step="5" value="${baseFrp}" class="w-full accent-red-500 bg-slate-700 h-1.5 rounded-lg cursor-pointer">
            <div class="flex justify-between text-[10px] text-slate-500">
              <span>5 MW (Routine)</span>
              <span>100 MW (Major Fire)</span>
              <span>300 MW (Catastrophic Surge)</span>
            </div>
          </div>
        </div>

        <!-- Right: Live Projected Outputs & Intersections (5 Cols) -->
        <div class="md:col-span-5 flex flex-col space-y-4">
          <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col space-y-3">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Simulated Projection</span>
              <span class="text-[10px] text-emerald-400 font-mono">DETERMINISTIC</span>
            </div>

            <!-- Metric Cards -->
            <div class="grid grid-cols-2 gap-2.5">
              <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold">Downwind Plume Axis</div>
                <div class="text-sm font-bold text-cyan-400 font-mono mt-0.5" id="sri-out-heading">---</div>
              </div>
              <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold">Hazard Horizon</div>
                <div class="text-sm font-bold text-amber-400 font-mono mt-0.5" id="sri-out-distance">---</div>
              </div>
              <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold">Affected Ground Area</div>
                <div class="text-sm font-bold text-red-400 font-mono mt-0.5" id="sri-out-area">---</div>
              </div>
              <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <div class="text-[10px] text-slate-400 font-semibold">Blast / Cordon Radius</div>
                <div class="text-sm font-bold text-yellow-400 font-mono mt-0.5" id="sri-out-cordon">---</div>
              </div>
            </div>

            <!-- Intersecting Assets -->
            <div class="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div class="text-[11px] font-bold text-slate-300">Potentially Affected Infrastructure:</div>
              <div id="sri-sim-infra-list" class="space-y-1 text-xs max-h-28 overflow-y-auto pr-1">
                <!-- Dynamically populated -->
              </div>
            </div>

            <!-- Protected Area Threat -->
            <div class="space-y-1 pt-2 border-t border-slate-800/80 text-xs">
              <div class="text-[11px] font-bold text-slate-300">Protected Ecological Sanctuary:</div>
              <div id="sri-sim-sanctuary" class="text-slate-400 font-mono text-[11px]">
                <!-- Dynamically populated -->
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <button id="sri-sim-project-globe-btn" class="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-lg shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer">
            <span>🌐</span>
            <span>Project Simulated Plume on 3D Globe</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach interactive listeners
  let selectedMode = 'BASELINE';
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
  const sanctuaryBox = document.getElementById('sri-sim-sanctuary');

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
      chemicalName: currentIncident.facility?.sector ? 'Toxic Industrial Vapor' : 'Wildfire Particulate PM2.5'
    });
    currentSimPayload = sim;

    outHeading.textContent = `${sim.projected_outputs.plume_centerline_azimuth_deg}°`;
    outDistance.textContent = `${sim.projected_outputs.downwind_hazard_distance_km.toFixed(1)} km`;
    outArea.textContent = `${sim.projected_outputs.total_affected_area_km2.toFixed(1)} km²`;
    outCordon.textContent = `${sim.projected_outputs.evacuation_recommendation_m} m`;

    // Render infra list
    const assets = sim.infrastructure_intersections.all_nearby || [];
    if (assets.length === 0) {
      infraList.innerHTML = '<div class="text-slate-500 italic">No linear pipeline or transmission line within hazard radius.</div>';
    } else {
      infraList.innerHTML = assets.map(a => `
        <div class="flex justify-between items-center py-1 border-b border-slate-800/40">
          <span class="text-slate-300 font-medium truncate max-w-[180px]">${a.asset_name}</span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded ${a.threat_state === 'POTENTIALLY_AFFECTED' ? 'bg-red-950/80 text-red-300 border border-red-800' : 'bg-slate-800 text-slate-400'}">
            ${a.distance_km} km (${a.relationship.split(' ')[0]})
          </span>
        </div>
      `).join('');
    }

    // Render sanctuary
    const sanct = sim.protected_area_threat.nearest_sanctuary;
    if (sanct) {
      sanctuaryBox.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-slate-200 font-semibold">${sanct.short_name || sanct.name}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background-color: ${sanct.threat_color}25; color: ${sanct.threat_color};">
            ${sanct.distance_km} km [${sanct.threat_level}]
          </span>
        </div>
      `;
    } else {
      sanctuaryBox.innerHTML = '<div class="text-slate-500 italic">Outside configured sanctuary proximity zone.</div>';
    }
  };

  // Attach slider input events
  speedSlider.addEventListener('input', updateSimulation);
  dirSlider.addEventListener('input', updateSimulation);
  frpSlider.addEventListener('input', updateSimulation);

  // Mode buttons
  const modeButtons = modalContainer.querySelectorAll('.sri-mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMode = btn.getAttribute('data-mode');
      modeButtons.forEach(b => {
        b.className = 'sri-mode-btn text-left p-2.5 rounded-lg border text-xs transition-all bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800';
      });
      btn.className = 'sri-mode-btn text-left p-2.5 rounded-lg border text-xs transition-all bg-amber-500/20 border-amber-500 text-amber-200';
      updateSimulation();
    });
  });

  // Project to Globe
  document.getElementById('sri-sim-project-globe-btn')?.addEventListener('click', () => {
    if (currentSimPayload && onProjectCallback) {
      onProjectCallback(currentSimPayload);
      closeSimulationLabModal();
    }
  });

  // Close button
  document.getElementById('sri-sim-close-btn')?.addEventListener('click', closeSimulationLabModal);

  // Initial calculation
  updateSimulation();
}
