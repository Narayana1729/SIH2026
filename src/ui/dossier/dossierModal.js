/**
 * @module ui/dossier/dossierModal
 * @description Executive Incident Briefing Dossier Modal for sriVision.
 * Calls the backend POST /api/dossier/generate endpoint for authoritative, auditable briefing reports.
 */

import { sriVisionApi } from '../../core/api.js';

export class DossierModal {
  constructor(containerId = 'sri-dossier-modal-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.isOpen = false;
    this._injectStyles();
  }

  async open(hazardContract) {
    if (!hazardContract) {
      hazardContract = window._sriActiveHazard || {
        id: 'INC-ACTIVE',
        title: 'Thermal Anomaly Target',
        hazard_type: 'WILDFIRE',
        severity: 'CRITICAL',
        location: { latitude: 21.11, longitude: 72.65, locality: 'Gujarat Industrial Corridor' },
        metrics: [{ label: 'FRP (MW)', value: 85.0 }],
      };
    }
    this.isOpen = true;
    this.renderLoading(hazardContract);

    try {
      const lat = Number(hazardContract.location?.latitude ?? hazardContract.latitude ?? hazardContract.lat ?? 21.11);
      const lon = Number(hazardContract.location?.longitude ?? hazardContract.longitude ?? hazardContract.lon ?? 72.65);
      const frpVal = Number(hazardContract.frp ?? hazardContract.metrics?.find((m) => m.label?.includes('FRP') || m.label?.includes('Power'))?.value ?? 45);
      const hazardType = hazardContract.hazard_type || hazardContract.type || 'WILDFIRE';
      const severity = hazardContract.severity || 'HIGH';
      const locality = hazardContract.location?.locality || hazardContract.title || hazardContract.locality || `Sector [${lat.toFixed(2)}N, ${lon.toFixed(2)}E]`;

      const resp = await sriVisionApi.generateTacticalDossier({
        lat,
        lon,
        latitude: lat,
        longitude: lon,
        incidentType: hazardType,
        type: hazardType,
        severity,
        locality,
        frp: frpVal,
      });

      const dossier = resp.dossier || resp.data || {};
      this.renderContent(hazardContract, dossier);
    } catch (err) {
      this.renderError(err);
    }
  }

  close() {
    this.isOpen = false;
    this.container.innerHTML = '';
  }

  renderLoading(h) {
    this.container.innerHTML = `
      <div class="sri-modal-backdrop">
        <div class="sri-modal-card">
          <div class="sri-modal-header">
            <h3>📋 GENERATING INCIDENT ACTION PLAN (IAP)...</h3>
            <button class="sri-modal-close" id="sri-dossier-close">&times;</button>
          </div>
          <div class="sri-modal-body loading">
            <p>Aggregating multi-source satellite telemetry, meteorological vectors, nearby HazMat sites, and emergency responder logistics for <strong>${h.title}</strong>...</p>
          </div>
        </div>
      </div>
    `;
    document.getElementById('sri-dossier-close')?.addEventListener('click', () => this.close());
  }

  renderError(err) {
    this.container.innerHTML = `
      <div class="sri-modal-backdrop">
        <div class="sri-modal-card">
          <div class="sri-modal-header">
            <h3>❌ DOSSIER GENERATION ERROR</h3>
            <button class="sri-modal-close" id="sri-dossier-close">&times;</button>
          </div>
          <div class="sri-modal-body">
            <p style="color: #ff3344;">Failed to compile tactical dossier: ${err.message}</p>
          </div>
        </div>
      </div>
    `;
    document.getElementById('sri-dossier-close')?.addEventListener('click', () => this.close());
  }

  renderContent(h, dossier) {
    const briefing = dossier.executive_summary || '';
    const facilities = dossier.high_hazard_facilities_at_risk || [];
    const responders = dossier.nearest_emergency_responders || {};
    const directives = dossier.commander_action_directives || [];
    const prov = dossier.provenance || {};

    const facilitiesHtml = facilities.map((f) => `
      <li class="sri-dossier-li"><strong>${f.name}</strong> (${f.distance_km || '?'} km away) · ${f.primary_chemical || 'HazMat'}: Initial isolation ${f.isolation_radius_m || 300}m</li>
    `).join('');

    const directivesHtml = directives.map((d) => `
      <li class="sri-dossier-dir">⚠️ ${d}</li>
    `).join('');

    const meteo = dossier.meteorology || {};
    const sim = dossier.simulation_models || {};
    const plume = sim.smoke_plume || {};

    let meteoHtml = '';
    if (meteo.wind_speed_kmh != null || meteo.temperature_c != null) {
      meteoHtml = `
        <div class="sri-dossier-sec">
          <div class="sri-dossier-label">LIVE METEOROLOGICAL OBSERVATION (OPEN-METEO)</div>
          <div class="sri-dossier-meteo-grid">
            <div class="sri-meteo-item"><span class="sri-m-k">Wind Speed:</span> <strong>${meteo.wind_speed_kmh || 0} km/h</strong></div>
            <div class="sri-meteo-item"><span class="sri-m-k">Wind Origin:</span> <strong>${meteo.wind_direction_deg || 0}°</strong></div>
            <div class="sri-meteo-item"><span class="sri-m-k">Surface Temp:</span> <strong>${meteo.temperature_c || 25}°C</strong></div>
            <div class="sri-meteo-item"><span class="sri-m-k">Rel Humidity:</span> <strong>${meteo.relative_humidity_pct || 40}%</strong></div>
          </div>
        </div>
      `;
    }

    let plumeHtml = '';
    if (plume.plume_heading_deg != null || plume.model_type) {
      plumeHtml = `
        <div class="sri-dossier-sec">
          <div class="sri-dossier-label">GAUSSIAN PLUME ATMOSPHERIC DISPERSION MODEL (PASQUILL-GIFFORD)</div>
          <div class="sri-dossier-plume-box">
            <div><strong>Plume Propagation Heading:</strong> ${plume.plume_heading_deg}° (Downwind Corridor)</div>
            <div><strong>Pasquill Stability Class:</strong> Class ${plume.stability_class || 'D'} (${plume.stability_class === 'A' || plume.stability_class === 'B' ? 'Unstable / Turbulent' : 'Neutral / Advective'})</div>
            <div><strong>Max Downwind Danger Envelope:</strong> ${plume.max_downwind_km || 15} km</div>
          </div>
        </div>
      `;
    }

    const latVal = Number(h.location?.latitude ?? h.latitude ?? h.lat ?? 0);
    const lonVal = Number(h.location?.longitude ?? h.longitude ?? h.lon ?? 0);

    this.container.innerHTML = `
      <div class="sri-modal-backdrop">
        <div class="sri-modal-card">
          <div class="sri-modal-header">
            <div>
              <h3>📋 INCIDENT ACTION PLAN (IAP) · TACTICAL BRIEFING</h3>
              <div class="sri-dossier-sub">${dossier.incident_id || 'INC-001'} · Compiled: ${new Date().toUTCString()}</div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="sri-pdf-download-btn" id="sri-dossier-pdf-btn">📄 DOWNLOAD 6-PAGE PDF</button>
              <button class="sri-print-btn" onclick="window.print()">PRINT 🖨️</button>
              <button class="sri-modal-close" id="sri-dossier-close">&times;</button>
            </div>
          </div>

          <div class="sri-modal-body">
            <div class="sri-dossier-sec">
              <div class="sri-dossier-label">EXECUTIVE SUMMARY</div>
              <p class="sri-dossier-text">${briefing || `Active ${h.hazard_type || h.type || 'Thermal'} emergency at [${latVal.toFixed(3)}°N, ${lonVal.toFixed(3)}°E]. Immediate multi-agency coordination required.`}</p>
            </div>

            ${meteoHtml}
            ${plumeHtml}

            <div class="sri-dossier-sec">
              <div class="sri-dossier-label">PRIMARY COMMAND DIRECTIVES</div>
              <ul class="sri-dossier-ul">${directivesHtml || '<li>Establish command perimeter and monitor real-time feeds.</li>'}</ul>
            </div>

            <div class="sri-dossier-sec">
              <div class="sri-dossier-label">HIGH-HAZARD INFRASTRUCTURE IN THREAT ENVELOPE</div>
              <ul class="sri-dossier-ul">${facilitiesHtml || '<li>No major Tier-1 industrial plants within immediate 20km radius.</li>'}</ul>
            </div>

            <div class="sri-dossier-sec">
              <div class="sri-dossier-label">EMERGENCY RESPONDER STAGING</div>
              <div class="sri-dossier-resp">
                <div><strong>Fire Units:</strong> ${(responders.fire_stations || []).length} nearby</div>
                <div><strong>NDRF / SDRF Units:</strong> ${(responders.disaster_response_battalions || []).length} nearby</div>
                <div><strong>Trauma Hospitals:</strong> ${(responders.hospitals || []).length} nearby</div>
              </div>
            </div>

            <div class="sri-dossier-sec prov">
              <div class="sri-dossier-label">DATA PROVENANCE & AUDIT TRAIL</div>
              <div style="font-size: 10px; color: #8899a6;">
                Authority: ${prov.source || 'sriVision Analytical Gateway'} · Model: ${prov.confidence_basis || 'Multi-source fused intelligence'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('sri-dossier-close')?.addEventListener('click', () => this.close());

    document.getElementById('sri-dossier-pdf-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const origText = btn.textContent;
      btn.textContent = 'GENERATING PDF... ⏳';
      btn.disabled = true;
      try {
        const resp = await fetch('/api/dossier/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: dossier.incident_id || h.id || `INC-${Date.now()}`,
            latitude: latVal,
            longitude: lonVal,
            lat: latVal,
            lon: lonVal,
            title: h.title || `Incident ${latVal.toFixed(2)}N, ${lonVal.toFixed(2)}E`,
            severity: h.severity || 'CRITICAL',
            frp: Number(h.frp ?? 85),
          }),
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `Incident_Action_Plan_${latVal.toFixed(2)}N_${lonVal.toFixed(2)}E.pdf`;
          link.click();
        }
      } catch (err) {
        console.error('PDF download error:', err);
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }

  _injectStyles() {
    if (document.getElementById('sri-dossier-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-dossier-styles';
    style.textContent = `
      .sri-modal-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(4, 6, 10, 0.82);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
      }
      .sri-modal-card {
        background: var(--glass-bg, rgba(12, 12, 20, 0.95));
        border: 1px solid rgba(0, 212, 255, 0.35);
        border-radius: var(--panel-radius, 14px);
        width: 660px;
        max-width: 92vw;
        max-height: 86vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 212, 255, 0.15) inset;
        color: var(--text-primary, #e8eaed);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        overflow: hidden;
      }
      .sri-modal-header {
        padding: 14px 20px;
        border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
        background: rgba(255, 255, 255, 0.02);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .sri-modal-header h3 {
        margin: 0;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1.5px;
        color: var(--accent, #00d4ff);
        text-transform: uppercase;
      }
      .sri-dossier-sub {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9.5px;
        letter-spacing: 0.8px;
        color: var(--text-dim, rgba(232, 234, 237, 0.4));
        margin-top: 3px;
      }
      .sri-modal-close {
        background: none;
        border: none;
        font-size: 22px;
        color: var(--text-dim);
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 150ms ease;
      }
      .sri-modal-close:hover { color: #fff; }
      .sri-print-btn {
        background: rgba(0, 212, 255, 0.1);
        border: 1px solid rgba(0, 212, 255, 0.35);
        color: var(--accent, #00d4ff);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1.2px;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 150ms ease;
      }
      .sri-print-btn:hover {
        background: rgba(0, 212, 255, 0.22);
        border-color: #00d4ff;
        color: #fff;
      }
      .sri-pdf-download-btn {
        background: linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0, 150, 255, 0.25));
        border: 1px solid rgba(0, 229, 255, 0.45);
        color: #00e5ff;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1px;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 150ms ease;
      }
      .sri-pdf-download-btn:hover {
        background: rgba(0, 229, 255, 0.35);
        border-color: #00e5ff;
        color: #fff;
        box-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
      }
      .sri-pdf-download-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      .sri-modal-body {
        padding: 18px 20px;
        overflow-y: auto;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 10px;
      }
      .sri-dossier-sec { margin-bottom: 14px; }
      .sri-dossier-sec.prov {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 10px;
      }
      .sri-dossier-label {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--text-dim, rgba(232, 234, 237, 0.5));
        margin-bottom: 5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding-bottom: 2px;
      }
      .sri-dossier-text {
        line-height: 1.6;
        color: var(--text-secondary, rgba(232, 234, 237, 0.8));
        margin: 0;
      }
      .sri-dossier-ul { margin: 0; padding-left: 14px; }
      .sri-dossier-dir { margin-bottom: 5px; color: #ffcc00; line-height: 1.5; }
      .sri-dossier-li { margin-bottom: 4px; color: var(--text-secondary, #b0c0d0); line-height: 1.4; }
      .sri-dossier-resp {
        display: flex;
        gap: 16px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.05);
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 9px;
      }
      .sri-dossier-meteo-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        background: rgba(0, 212, 255, 0.04);
        border: 1px solid rgba(0, 212, 255, 0.15);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 9px;
      }
      .sri-meteo-item { color: #b0c0d0; }
      .sri-meteo-item strong { color: var(--accent, #00d4ff); }
      .sri-dossier-plume-box {
        background: rgba(255, 153, 0, 0.05);
        border: 1px solid rgba(255, 153, 0, 0.2);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 9px;
        color: #e0e6ed;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sri-dossier-plume-box strong { color: #ffaa00; }
    `;
    document.head.appendChild(style);
  }
}
