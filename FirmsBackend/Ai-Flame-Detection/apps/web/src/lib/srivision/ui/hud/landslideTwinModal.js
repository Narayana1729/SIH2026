/**
 * @module ui/hud/landslideTwinModal
 * @description Next-Gen Living Slope Digital Twin HUD & Counterfactual Simulator Drawer.
 * Renders state machine progression, multi-timescale memory sparklines, kinematics gauges,
 * scenario-dependent rainfall forcing budgets, and interactive "What-If" stress simulation.
 */

import { sriVisionApi } from '../../core/api.js';

const STATE_COLORS = {
  HEALTHY: { bg: '#00e67622', border: '#00e676', text: '#00e676', label: 'HEALTHY / STABLE' },
  LOADING: { bg: '#00e5ff22', border: '#00e5ff', text: '#00e5ff', label: 'LOADING / INFILTRATING' },
  SATURATING: { bg: '#ffd70022', border: '#ffd700', text: '#ffd700', label: 'SATURATING / ELEVATED' },
  UNSTABLE: { bg: '#ff910022', border: '#ff9100', text: '#ff9100', label: 'UNSTABLE / NEAR-TRIGGER' },
  CRITICAL: { bg: '#ff174422', border: '#ff1744', text: '#ff1744', label: 'CRITICAL / FAILURE ACTIVE' },
  RECOVERY: { bg: '#d500f922', border: '#d500f9', text: '#d500f9', label: 'POST-STORM RECOVERY' },
};

export class LandslideTwinModal {
  constructor() {
    this.container = null;
    this.currentTwin = null;
    this.simulatedResults = null;
    this.init();
  }

  init() {
    if (document.getElementById('sri-landslide-twin-modal')) return;

    this.container = document.createElement('div');
    this.container.id = 'sri-landslide-twin-modal';
    this.container.className = 'sri-twin-modal-drawer';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);
  }

  async open(twinData) {
    this.currentTwin = twinData;
    this.simulatedResults = null;
    this.render();
    this.container.style.display = 'block';

    try {
      const historyData = await sriVisionApi.getSlopeTwinHistory(twinData.slopeId);
      if (historyData?.timeline) {
        this.renderHistorySparkline(historyData.timeline);
      }
    } catch (e) {
      console.warn('[LandslideTwinModal] Timeline history fetch failed:', e);
    }
  }

  close() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  render() {
    if (!this.currentTwin) return;

    const t = this.currentTwin;
    const stateKey = t.stateMachine?.currentState || 'HEALTHY';
    const stateStyle = STATE_COLORS[stateKey] || STATE_COLORS.HEALTHY;
    const hydro = t.hydrologicalMetrics || {};
    const kin = t.kinematics || {};
    const mem = t.slopeMemory || {};
    const mech = t.sentinelPhysicalMechanics || {};
    const ensemble = t.forecastEnsemble?.ensembleSummary || {};
    const scenarioBudgets = hydro.scenarioForcingBudgets || {};

    const loadRatio = Number(hydro.loadRatio || 0.0);
    const loadPct = Math.min(100, Math.round(loadRatio * 100));

    this.container.innerHTML = `
      <div class="twin-header">
        <div class="twin-title-wrap">
          <span class="twin-badge-icon">🏔️</span>
          <div>
            <h2 class="twin-name">${t.name}</h2>
            <div class="twin-subtitle">${t.region} • ${t.slopeId}</div>
          </div>
        </div>
        <button class="twin-close-btn" id="sri-twin-close-btn">✕</button>
      </div>

      <div class="twin-body">
        <!-- 1. State Machine Banner -->
        <div class="twin-state-banner" style="background:${stateStyle.bg}; border:1px solid ${stateStyle.border}; color:${stateStyle.text}">
          <div class="state-header-row">
            <span class="state-indicator-dot" style="background:${stateStyle.text}; box-shadow:0 0 10px ${stateStyle.text}"></span>
            <span class="state-title-text">${stateStyle.label}</span>
            <span class="state-load-tag">Load Ratio: ${loadRatio.toFixed(2)} / 1.0</span>
          </div>
          <div class="state-reason-text">${t.stateMachine?.stateReason || ''}</div>
          <div class="load-progress-bar-bg">
            <div class="load-progress-bar-fill" style="width:${loadPct}%; background:${stateStyle.border}"></div>
          </div>
        </div>

        <!-- 2. Scenario-Dependent Rainfall Forcing Budgets (Replacing single scalar) -->
        <div class="twin-section-panel">
          <div class="section-title">🌧️ Critical Rainfall Forcing Budgets</div>
          <div class="scenario-budgets-list">
            <div class="scenario-budget-row">
              <span class="sc-name">⚡ Burst (1h):</span>
              <strong class="sc-val text-cyan">${scenarioBudgets.scenarioBurst1h?.rangeLabel || '12–18 mm in 1 hr'}</strong>
            </div>
            <div class="scenario-budget-row">
              <span class="sc-name">🌧️ Sustained (3h):</span>
              <strong class="sc-val ${loadRatio >= 0.85 ? 'text-danger' : 'text-cyan'}">${scenarioBudgets.scenarioSustained3h?.rangeLabel || '28–42 mm in 3 hrs'}</strong>
            </div>
            <div class="scenario-budget-row">
              <span class="sc-name">🌊 Prolonged (12h):</span>
              <strong class="sc-val text-cyan">${scenarioBudgets.scenarioProlonged12h?.rangeLabel || '55–70 mm in 12 hrs'}</strong>
            </div>
          </div>
          <div class="card-subtext" style="margin-top:6px;">${scenarioBudgets.calibratedStatement || 'Estimated additional rainfall forcing required to cross critical trigger boundary.'}</div>
        </div>

        <!-- 3. Core Metrics Grid -->
        <div class="twin-metrics-grid">
          <div class="twin-card">
            <div class="card-label">RELATIVE SUSCEPTIBILITY (RTS)</div>
            <div class="card-value">${hydro.triggerResistance?.toFixed(2) || '0.50'} <span class="unit">/ 1.0</span></div>
            <div class="card-subtext">Slope: ${t.coordinates?.elevationM || 980}m • ${t.terrain?.slopeDegrees || 34}°</div>
          </div>

          <div class="twin-card">
            <div class="card-label">HAZARD MOMENTUM</div>
            <div class="card-value-kinematic ${kin.riskVelocityPerHr >= 0.05 ? 'text-warning' : 'text-white'}">
              V: ${kin.riskVelocityPerHr >= 0 ? '+' : ''}${kin.riskVelocityPerHr?.toFixed(3) || '0.000'}/h
            </div>
            <div class="card-subtext">Trend: <strong>${kin.trend || 'STABLE'}</strong></div>
          </div>

          <div class="twin-card">
            <div class="card-label">PHYSICAL FACTOR OF SAFETY</div>
            <div class="card-value-fs ${mech.factorOfSafety && mech.factorOfSafety < 1.1 ? 'text-danger' : 'text-green'}">
              FS = ${mech.factorOfSafety?.toFixed(2) || 'N/A'}
            </div>
            <div class="card-subtext">Sentinel Verdict: ${mech.stabilityVerdict || 'UNAVAILABLE'}</div>
          </div>

          <div class="twin-card">
            <div class="card-label">INSAR STRUCTURAL DISPLACEMENT</div>
            <div class="card-value">${mech.inSarDisplacementMm ? `${mech.inSarDisplacementMm.toFixed(1)} mm` : 'No Def'}</div>
            <div class="card-subtext">Long-term baseline deformation</div>
          </div>
        </div>

        <!-- 4. Multi-Timescale Memory Breakdown -->
        <div class="twin-section-panel">
          <div class="section-title">🌊 Multi-Timescale Slope Memory</div>
          <div class="memory-channels-row">
            <div class="mem-channel">
              <span class="mem-tag">FAST (Hours)</span>
              <span class="mem-val">${mem.fastMm?.toFixed(1) || '0.0'} mm</span>
            </div>
            <div class="mem-channel">
              <span class="mem-tag">MEDIUM (Days)</span>
              <span class="mem-val">${mem.mediumMm?.toFixed(1) || '0.0'} mm</span>
            </div>
            <div class="mem-channel">
              <span class="mem-tag">SLOW (Weeks)</span>
              <span class="mem-val">${mem.slowMm?.toFixed(1) || '0.0'} mm</span>
            </div>
          </div>
          <div id="twin-history-sparkline-container" class="sparkline-container">
            <div class="sparkline-loading">Loading 24-hour memory dissipation timeline...</div>
          </div>
        </div>

        <!-- 5. Probabilistic Ensemble Failure Windows -->
        <div class="twin-section-panel">
          <div class="section-title">⏳ Probabilistic Failure Windows (Ensemble)</div>
          <div class="ensemble-windows-grid">
            <div class="window-pill">
              <span class="w-label">🟡 WATCH WINDOW</span>
              <span class="w-val">${ensemble.watchWindowHours?.expectedHours ? `+${ensemble.watchWindowHours.expectedHours} hrs` : 'No Watch Window'}</span>
            </div>
            <div class="window-pill">
              <span class="w-label">🟠 WARNING WINDOW</span>
              <span class="w-val">${ensemble.warningWindowHours?.expectedHours ? `+${ensemble.warningWindowHours.expectedHours} hrs` : 'No Warning Window'}</span>
            </div>
            <div class="window-pill ${ensemble.criticalPossibility === 'LIKELY' ? 'w-critical' : ''}">
              <span class="w-label">🔴 CRITICAL TRIGGER</span>
              <span class="w-val">${ensemble.criticalWindowHours?.expectedHours ? `+${ensemble.criticalWindowHours.expectedHours} hrs` : 'Unlikely'}</span>
            </div>
          </div>
        </div>

        <!-- 6. Interactive Counterfactual Simulator -->
        <div class="twin-section-panel simulator-panel">
          <div class="section-title">⚡ Interactive "What-If" Stress Simulator</div>
          <div class="sim-controls">
            <label class="sim-label">Inject Hypothetical Rainfall: <span id="sim-rain-val" class="text-cyan">30 mm</span></label>
            <input type="range" id="sim-rain-slider" min="5" max="150" step="5" value="30" class="sim-slider">
            <button id="sim-run-btn" class="sim-run-btn">Simulate State Transition</button>
          </div>
          <div id="sim-result-box" class="sim-result-box" style="display:none;"></div>
        </div>

        <!-- 7. Provenance & Confidence Assessment -->
        <div class="twin-provenance-footer">
          <div class="provenance-tag">
            <strong>TELEMETRY CONFIDENCE:</strong> ${t.confidence?.level || 'MODERATE'} (${Math.round((t.confidence?.score || 0.5) * 100)}%)
          </div>
          <div class="provenance-text">${t.confidence?.rationale || ''}</div>
        </div>
      </div>
    `;

    document.getElementById('sri-twin-close-btn')?.addEventListener('click', () => this.close());

    const slider = document.getElementById('sim-rain-slider');
    const rainVal = document.getElementById('sim-rain-val');
    slider?.addEventListener('input', (e) => {
      if (rainVal) rainVal.innerText = `${e.target.value} mm`;
    });

    document.getElementById('sim-run-btn')?.addEventListener('click', () => {
      const val = Number(slider?.value || 30);
      this.runSimulation(val);
    });
  }

  async runSimulation(additionalRainMm) {
    const resultBox = document.getElementById('sim-result-box');
    if (!resultBox || !this.currentTwin) return;

    resultBox.style.display = 'block';
    resultBox.innerHTML = '<div class="sim-loading">Running non-linear state simulation...</div>';

    try {
      const res = await sriVisionApi.simulateSlopeStress({
        slopeId: this.currentTwin.slopeId,
        additionalRainMm,
      });

      const simState = res.currentState || 'SATURATING';
      const simStyle = STATE_COLORS[simState] || STATE_COLORS.HEALTHY;

      resultBox.innerHTML = `
        <div class="sim-result-header" style="color:${simStyle.text}">
          <span>Simulated Outcome: <strong>${simState}</strong></span>
          <span>Load Ratio: ${res.loadRatio?.toFixed(2)}</span>
        </div>
        <div class="sim-result-details">
          <div>Remaining Budget: <strong>${res.remainingTriggerBudgetMm} mm</strong></div>
          <div>Momentum: <strong>${res.riskTrend}</strong></div>
          ${res.factorOfSafety ? `<div>Physical FS: <strong>${res.factorOfSafety.toFixed(2)}</strong></div>` : ''}
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = `<div class="text-danger">Simulation failed: ${err.message}</div>`;
    }
  }

  renderHistorySparkline(timeline = []) {
    const container = document.getElementById('twin-history-sparkline-container');
    if (!container || !timeline.length) return;

    const maxRain = Math.max(...timeline.map((t) => t.rainfallMm), 40);
    const barsHtml = timeline.map((step) => {
      const heightPct = Math.round((step.rainfallMm / maxRain) * 100);
      const stateKey = step.state || 'HEALTHY';
      const color = STATE_COLORS[stateKey]?.border || '#00e5ff';
      return `
        <div class="spark-bar-wrap" title="${step.hoursAgo}h ago: ${step.rainfallMm}mm (${step.state})">
          <div class="spark-bar" style="height:${heightPct}%; background:${color}"></div>
          <span class="spark-label">-${step.hoursAgo}h</span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="sparkline-bars-row">
        ${barsHtml}
      </div>
    `;
  }
}
