/**
 * AI Simulation Lab / What-If Sandbox Modal
 * 
 * Interactive parameter tuning sandbox that lets users simulate hypothetical
 * thermal hazard scenarios in real time with instant Planck-Dozier sub-pixel
 * pyrometry, AI classification shifts, and Gaussian Plume dispersion buffers.
 */

import { solveDozierPyrometry } from '../../disasters/pyrometry/dozierPyrometry.js';
import { classifyThermalIncident } from '../../intelligence/thermalClassifier.js';
import { resolveEventAttributions } from '../../intelligence/shapExplainer.js';

let modalElement = null;

export function openAiSimulationLabModal() {
  if (!modalElement) {
    createSimLabDOM();
  }
  updateSimulation();
  modalElement.style.display = 'flex';
}

export function closeAiSimulationLabModal() {
  if (modalElement) {
    modalElement.style.display = 'none';
  }
}

function createSimLabDOM() {
  modalElement = document.createElement('div');
  modalElement.id = 'ai-sim-lab-container';
  modalElement.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(4, 9, 20, 0.85);
    backdrop-filter: blur(14px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e2e8f0;
  `;

  modalElement.innerHTML = `
    <div style="
      background: linear-gradient(145deg, #091220, #040810);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 14px;
      width: 780px;
      max-width: 94vw;
      max-height: 92vh;
      overflow-y: auto;
      box-shadow: 0 25px 70px rgba(0,0,0,0.85), 0 0 50px rgba(56,189,248,0.15);
      padding: 24px;
    ">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 14px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; border-radius: 8px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🧪
          </div>
          <div>
            <h2 style="margin: 0; font-size: 19px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px;">AI SIMULATION LAB & WHAT-IF SANDBOX</h2>
            <div style="font-size: 12px; color: #94a3b8;">Real-Time Multiphysics Pyrometry & Hazard Classification Model</div>
          </div>
        </div>
        <button id="simlab-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer;">✕</button>
      </div>

      <!-- Presets Toolbar -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 8px;">Load Real-World Scenarios:</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="sim-preset-btn" data-preset="flare" style="background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.4); color: #fb923c; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">🔥 Jamnagar Flare Outburst</button>
          <button class="sim-preset-btn" data-preset="wildfire" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">🌲 Bandhavgarh Canopy Crown Fire</button>
          <button class="sim-preset-btn" data-preset="stubble" style="background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.4); color: #fde047; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">🌾 Punjab Agri Stubble Burn</button>
        </div>
      </div>

      <!-- Two-column Body: Sliders vs Dynamic Outputs -->
      <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 20px;">
        <!-- Left: Sliders -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 18px;">
          <div style="font-size: 13px; font-weight: 700; color: #f1f5f9; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">Input Parameters</div>

          <!-- Slider 1: FRP -->
          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Fire Radiative Power (FRP)</span>
              <span id="val-frp" style="color: #fb923c; font-weight: 700;">45 MW</span>
            </div>
            <input type="range" id="slider-frp" min="1" max="400" value="45" style="width: 100%; accent-color: #fb923c;" />
          </div>

          <!-- Slider 2: Refinery Proximity -->
          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Refinery Perimeter Distance</span>
              <span id="val-dist" style="color: #38bdf8; font-weight: 700;">1.2 km</span>
            </div>
            <input type="range" id="slider-dist" min="0" max="25" step="0.2" value="1.2" style="width: 100%; accent-color: #38bdf8;" />
          </div>

          <!-- Slider 3: 90-Day Recurrence -->
          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Historical Recurrence (P-Index)</span>
              <span id="val-rec" style="color: #a855f7; font-weight: 700;">12 pulses</span>
            </div>
            <input type="range" id="slider-rec" min="1" max="30" value="12" style="width: 100%; accent-color: #a855f7;" />
          </div>

          <!-- Slider 4: Wind Speed -->
          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Surface Wind Velocity</span>
              <span id="val-wind" style="color: #34d399; font-weight: 700;">18 km/h</span>
            </div>
            <input type="range" id="slider-wind" min="0" max="60" value="18" style="width: 100%; accent-color: #34d399;" />
          </div>

          <!-- Slider 5: MIR Brightness Temp -->
          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>VIIRS Band 4 Brightness</span>
              <span id="val-mir" style="color: #f43f5e; font-weight: 700;">345 K</span>
            </div>
            <input type="range" id="slider-mir" min="300" max="375" value="345" style="width: 100%; accent-color: #f43f5e;" />
          </div>
        </div>

        <!-- Right: AI Inversion & Physics Results -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Classification Card -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">AI Classification Verdict</div>
            <div id="sim-verdict-title" style="font-size: 16px; font-weight: 800; color: #fb923c; margin-bottom: 4px;">Gas Flare (Hydrocarbon)</div>
            <div id="sim-verdict-confidence" style="font-size: 12px; color: #38bdf8;">Confidence: 96.4% | Spatial Score: 0.94</div>
          </div>

          <!-- Planck / Dozier Physics Card -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 8px;">Planck / Dozier Sub-Pixel Solver</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
              <div>
                <span style="color: #94a3b8;">True Flame Temp:</span><br/>
                <strong id="sim-dozier-temp" style="font-size: 14px; color: #f87171;">1,420 K (1,147°C)</strong>
              </div>
              <div>
                <span style="color: #94a3b8;">Combustion Area:</span><br/>
                <strong id="sim-dozier-area" style="font-size: 14px; color: #fbbf24;">18.4 m²</strong>
              </div>
              <div>
                <span style="color: #94a3b8;">Radiant Flux:</span><br/>
                <strong id="sim-dozier-flux" style="font-size: 13px; color: #e2e8f0;">230.8 kW/m²</strong>
              </div>
              <div>
                <span style="color: #94a3b8;">Pixel Fraction:</span><br/>
                <strong id="sim-dozier-frac" style="font-size: 13px; color: #e2e8f0;">0.013%</strong>
              </div>
            </div>
          </div>

          <!-- Gaussian Plume Impact -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Gaussian Plume Hazard Footprint</div>
            <div style="font-size: 12px; color: #cbd5e1;">
              Est. Smoke Buffer: <strong id="sim-plume-buffer" style="color: #34d399;">2.8 km downwind</strong><br/>
              Peak Ground Concentration: <strong id="sim-plume-pm25" style="color: #f87171;">185 µg/m³ PM2.5</strong>
            </div>
          </div>

          <!-- Explainability & Multi-Modal Context Card -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Explainability & Multi-Modal Context</div>
              <span id="sim-xai-badge" style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 600;">Feature Attributions</span>
            </div>
            <div id="sim-xai-bars" style="margin-bottom: 8px;"></div>
            <div id="sim-sat-context" style="font-size: 11px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalElement);

  // Close handlers
  modalElement.querySelector('#simlab-close-btn').addEventListener('click', closeAiSimulationLabModal);
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) closeAiSimulationLabModal();
  });

  // Slider change listeners
  ['frp', 'dist', 'rec', 'wind', 'mir'].forEach(id => {
    modalElement.querySelector(`#slider-${id}`).addEventListener('input', updateSimulation);
  });

  // Preset listeners
  modalElement.querySelectorAll('.sim-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const preset = e.currentTarget.dataset.preset;
      applyPreset(preset);
    });
  });
}

function applyPreset(preset) {
  const sFrp = modalElement.querySelector('#slider-frp');
  const sDist = modalElement.querySelector('#slider-dist');
  const sRec = modalElement.querySelector('#slider-rec');
  const sWind = modalElement.querySelector('#slider-wind');
  const sMir = modalElement.querySelector('#slider-mir');

  if (preset === 'flare') {
    sFrp.value = 65;
    sDist.value = 0.8;
    sRec.value = 18;
    sWind.value = 14;
    sMir.value = 358;
  } else if (preset === 'wildfire') {
    sFrp.value = 180;
    sDist.value = 18.5;
    sRec.value = 1;
    sWind.value = 32;
    sMir.value = 328;
  } else if (preset === 'stubble') {
    sFrp.value = 22;
    sDist.value = 12.0;
    sRec.value = 3;
    sWind.value = 10;
    sMir.value = 318;
  }

  updateSimulation();
}

function updateSimulation() {
  if (!modalElement) return;

  const frp = parseFloat(modalElement.querySelector('#slider-frp').value);
  const dist = parseFloat(modalElement.querySelector('#slider-dist').value);
  const rec = parseInt(modalElement.querySelector('#slider-rec').value, 10);
  const wind = parseFloat(modalElement.querySelector('#slider-wind').value);
  const mir = parseFloat(modalElement.querySelector('#slider-mir').value);

  // Update slider label texts
  modalElement.querySelector('#val-frp').textContent = `${frp} MW`;
  modalElement.querySelector('#val-dist').textContent = `${dist.toFixed(1)} km`;
  modalElement.querySelector('#val-rec').textContent = `${rec} pulses`;
  modalElement.querySelector('#val-wind').textContent = `${wind} km/h`;
  modalElement.querySelector('#val-mir').textContent = `${mir} K`;

  // Solve Dozier Pyrometry
  const dozier = solveDozierPyrometry(mir, 296, frp);
  modalElement.querySelector('#sim-dozier-temp').textContent = `${dozier.flameTempK} K (${dozier.flameTempC}°C)`;
  modalElement.querySelector('#sim-dozier-area').textContent = `${dozier.flameAreaM2} m²`;
  modalElement.querySelector('#sim-dozier-flux').textContent = `${dozier.radiantHeatFluxKwM2} kW/m²`;
  modalElement.querySelector('#sim-dozier-frac').textContent = `${(dozier.fractionalPixelArea * 100).toFixed(4)}%`;

  // Solve AI Classification
  const hazardMock = {
    frp,
    distKm: dist,
    recurrenceIndex: rec,
    bright_ti4: mir,
    bright_ti5: 296,
    daynight: 'N'
  };
  const classification = classifyThermalIncident(hazardMock, []);

  const verdictTitle = modalElement.querySelector('#sim-verdict-title');
  verdictTitle.textContent = classification.category || (dist < 4 ? 'Gas Flare (Hydrocarbon)' : 'Wildfire / Forest Fire');
  verdictTitle.style.color = classification.category?.includes('Flare') ? '#fb923c' : '#f87171';

  modalElement.querySelector('#sim-verdict-confidence').textContent = 
    `Confidence: ${Math.round((classification.confidence ?? 0.92) * 100)}% | Risk Level: ${frp > 100 ? 'EXTREME' : 'MODERATE'}`;

  // Plume buffer calculation
  const bufferKm = Math.min(12, Math.max(0.8, (frp * 0.03) + (wind * 0.08))).toFixed(1);
  const pm25 = Math.round(Math.min(650, (frp * 3.5) + 30));
  modalElement.querySelector('#sim-plume-buffer').textContent = `${bufferKm} km downwind (${wind} km/h vector)`;
  modalElement.querySelector('#sim-plume-pm25').textContent = `${pm25} µg/m³ PM2.5 (Exceeds WHO Standard)`;

  // Explainability & Multi-Modal Context update
  const resolved = resolveEventAttributions(hazardMock, classification);
  const xaiBadge = modalElement.querySelector('#sim-xai-badge');
  if (xaiBadge) {
    xaiBadge.textContent = resolved.is_exact_shap ? 'Exact TreeSHAP (DP)' : 'Domain Heuristic';
    xaiBadge.style.color = resolved.is_exact_shap ? '#34d399' : '#fbbf24';
    xaiBadge.style.background = resolved.is_exact_shap ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)';
  }

  const items = (resolved.attributions || []).slice(0, 4);
  const maxVal = Math.max(...items.map((it) => Math.abs(it.shapValue !== undefined ? it.shapValue : (it.impact || 0.1))), 0.001);
  const barsContainer = modalElement.querySelector('#sim-xai-bars');
  if (barsContainer) {
    barsContainer.innerHTML = items.map((r) => {
      const val = r.shapValue !== undefined ? r.shapValue : (r.impact || 0);
      const isPos = r.isPositive !== undefined ? r.isPositive : (val > 0);
      const scoreStr = (val > 0 ? '+' : '') + (typeof val === 'number' ? val.toFixed(2) : val);
      const pct = Math.min(100, Math.max(12, Math.round((Math.abs(val) / maxVal) * 100)));
      return `
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
            <span style="color: #cbd5e1;">${r.feature}</span>
            <span style="color: ${isPos ? '#34d399' : '#f87171'}; font-weight: 700; font-family: monospace;">${scoreStr}</span>
          </div>
          <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${isPos ? '#34d399' : '#f87171'}; border-radius: 2px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Simulated Optical & LULC responses based on scenario
  const satContainer = modalElement.querySelector('#sim-sat-context');
  if (satContainer) {
    const isFlare = dist < 2.0;
    const estNdvi = isFlare ? 0.12 : (dist > 10 ? 0.68 : 0.38);
    const estNbr = isFlare ? -0.22 : (dist > 10 ? 0.44 : 0.05);
    const estSwir = isFlare ? 1.85 : 0.92;
    const lulcPrimary = isFlare ? 'Built-up / Industrial' : (dist > 10 ? 'Tree Cover / Forest' : 'Cropland');

    satContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>Simulated LULC: <strong style="color: #38bdf8;">${lulcPrimary}</strong></span>
        <span>ESA 10m Grounding</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #94a3b8;">
        <span>NDVI: <strong style="color: #34d399;">${estNdvi.toFixed(2)}</strong></span>
        <span>NBR: <strong style="color: #f59e0b;">${estNbr.toFixed(2)}</strong></span>
        <span>SWIR Ratio: <strong style="color: #f43f5e;">${estSwir.toFixed(2)}</strong></span>
      </div>
    `;
  }
}
