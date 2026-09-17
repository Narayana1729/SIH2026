/**
 * @module ui/panels/hazardInspector
 * @description Operational Hazard Inspector Side-Panel for sriVision.
 * Displays normalized hazard details, physical metrics, operator directives,
 * nearby emergency responders, and explicit scientific data provenance.
 */

import { CLASSIFICATION_TAGS, SEVERITY_COLORS, HAZARD_ICONS } from '../../core/risk.js';
import { eventBus, SRI_EVENTS } from '../../core/eventBus.js';

export class HazardInspector {
  constructor(containerId = 'hazard-inspector-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.currentHazard = null;
    this.onGenerateDossier = null;

    this._injectStyles();
    this._setupEventSubscriptions();
    this.renderEmpty();
  }

  _setupEventSubscriptions() {
    eventBus.on(SRI_EVENTS.HAZARD_SELECTED, (hazard) => {
      this.setHazard(hazard);
    });

    eventBus.on(SRI_EVENTS.TERRAIN_PROBE_CLICKED, (probe) => {
      this.setHazard({
        id: `probe-${Date.now()}`,
        hazard_type: 'LANDSLIDE',
        title: `📍 Terrain Probe: [${probe.latitude}, ${probe.longitude}]`,
        subtitle: `Elevation: ${probe.elevationM}m MSL · Interactive Ground Probe`,
        data_classification: 'SIMULATED',
        severity: 'MODERATE',
        location: { latitude: probe.latitude, longitude: probe.longitude, elevationM: probe.elevationM },
        metrics: [
          { label: 'Surface Elevation', value: probe.elevationM, unit: 'm', status: 'NORMAL' },
          { label: 'Target Latitude', value: probe.latitude, unit: '°N', status: 'NORMAL' },
          { label: 'Target Longitude', value: probe.longitude, unit: '°E', status: 'NORMAL' },
          { label: 'Interactive State', value: 'Active Probe', unit: '', status: 'NORMAL' },
        ],
        actions: [
          'Shift-Click active: Click "Generate Tactical Briefing Dossier" to run multi-source perimeter analysis for this coordinate.',
        ],
        provenance: {
          source: 'Cesium Terrain Elevation Sampler',
          source_type: 'REAL_LIVE',
          confidence_basis: 'DIRECT_GLOBE_PROBE',
        },
      });
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('gev:entity-selected', (e) => {
        const d = e.detail;
        if (!d) return;

        if (d.layerId === 'local-industrial') {
          const p = d.properties || {};
          const cap = p.capacity_mw ? `${p.capacity_mw} MW` : (p.capacity || 'N/A');
          const cat = p.category || 'Industrial / Infrastructure';
          const type = p.type || 'Facility';
          const isPetro = cat === 'Petrochemical / Refinery' || /refinery|oil|gas|chemical/i.test(type);

          this.setHazard({
            id: `ind-${d.id || Date.now()}`,
            hazard_type: 'INDUSTRIAL_HAZARD',
            title: `🏭 ${d.label || p.name || 'Industrial Facility'}`,
            subtitle: `${cat} · ${type}`,
            data_classification: 'REAL_REFERENCE',
            severity: isPetro ? 'HIGH' : 'MODERATE',
            location: {
              latitude: d.latitude || p.lat || 0,
              longitude: d.longitude || p.lon || 0,
              locality: p.state || p.district || 'India Grid',
            },
            facility: {
              name: d.label || p.name,
              category: cat,
              type: type,
              capacity_mw: p.capacity_mw,
              source: p.source || d.source,
            },
            metrics: [
              { label: 'Facility Sector', value: cat, unit: '', status: isPetro ? 'WARNING' : 'NORMAL' },
              { label: 'Installed Capacity', value: cap, unit: '', status: 'NORMAL' },
              { label: 'Plant Type', value: type, unit: '', status: 'NORMAL' },
              { label: 'HazMat Protocol', value: isPetro ? 'Class 3 / Flammable & Toxic Cloud' : 'Standard Industrial Safety', unit: '', status: isPetro ? 'WARNING' : 'NORMAL' },
            ],
            actions: [
              'Facility Monitoring: Continuous thermal anomaly tracking across operational boundary.',
              isPetro
                ? 'High HazMat Potential: Maintain 800m initial isolation zone in case of containment breach.'
                : 'Industrial Grid: Coordinate with regional fire & power dispatch authorities.',
            ],
            provenance: {
              source: p.source || d.source || 'CPCB / MoEFCC / Power Database',
              source_type: 'REAL_REFERENCE',
              confidence_basis: 'OFFICIAL_REGISTRY',
            },
          });
        } else if (d.layerId === 'local-dams') {
          const p = d.properties || {};
          const tags = p.tags || {};
          const river = p.associated_river || p.river || tags.associated_river || tags.river || 'Water Basin';
          const output = p.output || tags['plant:output:electricity'] || 'Hydro Asset';

          this.setHazard({
            id: `dam-${d.id || Date.now()}`,
            hazard_type: 'FLOOD',
            title: `▰ ${d.label || p.name || 'Dam & Reservoir'}`,
            subtitle: `Dam & Water Reservoir · ${river}`,
            data_classification: 'REAL_REFERENCE',
            severity: 'MODERATE',
            location: {
              latitude: d.latitude || 0,
              longitude: d.longitude || 0,
              locality: river,
            },
            metrics: [
              { label: 'Associated River', value: river, unit: '', status: 'NORMAL' },
              { label: 'Hydro Output', value: output, unit: '', status: 'NORMAL' },
              { label: 'Structural Type', value: 'Dam / Reservoir Barrier', unit: '', status: 'NORMAL' },
              { label: 'Catchment Status', value: 'Monitored Hydro Asset', unit: '', status: 'NORMAL' },
            ],
            actions: [
              'Downstream Inundation Protocol: Monitor rainfall runoff in upstream basin.',
              'Spillway Dispatch: Coordinate discharge rates with regional flood warning centers.',
            ],
            provenance: {
              source: d.source || 'USACE / Global Dams Database',
              source_type: 'REAL_REFERENCE',
              confidence_basis: 'OFFICIAL_REGISTRY',
            },
          });
        }
      });
    }
  }

  setHazard(hazardContract) {
    this.currentHazard = hazardContract;
    if (!hazardContract) {
      this.renderEmpty();
      return;
    }
    this.render();
  }

  renderEmpty() {
    this.container.innerHTML = `
      <div class="sri-inspector-panel empty">
        <div class="sri-inspector-header">
          <span class="sri-inspector-title">🚨 HAZARD INTELLIGENCE INSPECTOR</span>
        </div>
        <div class="sri-inspector-body empty-text">
          <p>Select any active wildfire, industrial facility, chemical plume, or mountain warning marker on the globe to inspect real-time physics, risk metrics, and tactical evacuation directives.</p>
        </div>
      </div>
    `;
  }

  render() {
    const h = this.currentHazard;
    const icon = HAZARD_ICONS[h.hazard_type] || '📍';
    const tag = CLASSIFICATION_TAGS[h.data_classification] || CLASSIFICATION_TAGS.ESTIMATED;
    const sev = SEVERITY_COLORS[h.severity] || SEVERITY_COLORS.MODERATE;

    const metricsHtml = (h.metrics || []).map((m) => `
      <div class="sri-metric-card">
        <div class="sri-metric-label">${m.label}</div>
        <div class="sri-metric-val ${m.status === 'CRITICAL' ? 'val-crit' : m.status === 'WARNING' ? 'val-warn' : ''}">
          ${m.value} <span class="sri-metric-unit">${m.unit || ''}</span>
        </div>
      </div>
    `).join('');

    const actionsHtml = (h.actions || []).map((a) => `
      <li class="sri-action-item"><strong>Directive:</strong> ${a}</li>
    `).join('');

    const prov = h.provenance || {};
    const limits = prov.scientific_limitations || [];
    const limitationsHtml = limits.map((l) => `<li>${l}</li>`).join('');

    let respondersHtml = '';
    if (h.responders) {
      const resp = h.responders;
      const fires = (resp.fire_stations || []).slice(0, 2);
      const ndrf = (resp.disaster_response_battalions || []).slice(0, 2);
      const hosps = (resp.hospitals || []).slice(0, 2);

      respondersHtml = `
        <div class="sri-section-title">🚒 NEARBY EMERGENCY RESPONDERS</div>
        <div class="sri-responders-list">
          ${fires.map((f) => `<div class="sri-resp-row">🚒 ${f.name} · ${f.distance_km || '?'}km away (Phone: ${f.contact_phone || '101'})</div>`).join('')}
          ${ndrf.map((n) => `<div class="sri-resp-row">🛡️ ${n.name} · ${n.distance_km || '?'}km away (Phone: ${n.contact_phone || '1070'})</div>`).join('')}
          ${hosps.map((hosp) => `<div class="sri-resp-row">🏥 ${hosp.name} · ${hosp.distance_km || '?'}km away</div>`).join('')}
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="sri-inspector-panel active">
        <div class="sri-inspector-header">
          <div class="sri-header-top">
            <span class="sri-header-icon">${icon}</span>
            <div class="sri-header-text">
              <div class="sri-header-title">${h.title}</div>
              <div class="sri-header-subtitle">${h.subtitle || ''}</div>
            </div>
            <button class="sri-close-btn" id="sri-inspector-close" title="Close Panel">&times;</button>
          </div>
          <div class="sri-badge-row">
            <span class="sri-tag" style="background: ${tag.bg}; color: ${tag.text}; border: 1px solid rgba(255,255,255,0.15);" title="${tag.desc}">
              ● ${tag.label}
            </span>
            <span class="sri-sev-tag" style="background: ${sev.hex}; color: #fff;">
              ${sev.label}
            </span>
          </div>
        </div>

        <div class="sri-inspector-body">
          <div class="sri-section-title">PHYSICAL PARAMETERS & SENSORS</div>
          <div class="sri-metrics-grid">
            ${metricsHtml}
          </div>

          <div class="sri-section-title">TACTICAL DIRECTIVES</div>
          <ul class="sri-actions-list">
            ${actionsHtml || '<li>Routine monitoring active.</li>'}
          </ul>

          ${respondersHtml}

          <div class="sri-section-title">DATA PROVENANCE & LIMITATIONS</div>
          <div class="sri-prov-box">
            <div class="sri-prov-row"><span class="sri-prov-k">Source:</span> ${prov.source || 'sriVision Analytical Engine'}</div>
            <div class="sri-prov-row"><span class="sri-prov-k">Classification:</span> ${prov.source_type || h.data_classification || 'PHYSICAL_MODEL'}</div>
            <div class="sri-prov-row"><span class="sri-prov-k">Calibration:</span> ${prov.confidence_basis || 'Calibrated physical baseline'}</div>
            ${limits.length ? `<div class="sri-prov-limits"><span class="sri-prov-k">Scientific Caveats:</span><ul>${limitationsHtml}</ul></div>` : ''}
          </div>

          <button class="sri-dossier-btn" id="sri-generate-dossier-btn">
            GENERATE TACTICAL BRIEFING DOSSIER
          </button>
        </div>
      </div>
    `;

    document.getElementById('sri-inspector-close')?.addEventListener('click', () => {
      this.renderEmpty();
    });

    document.getElementById('sri-generate-dossier-btn')?.addEventListener('click', () => {
      if (this.onGenerateDossier && this.currentHazard) {
        this.onGenerateDossier(this.currentHazard);
      }
    });
  }

  _injectStyles() {
    if (document.getElementById('sri-inspector-styles')) return;
    const style = document.createElement('style');
    style.id = 'sri-inspector-styles';
    style.textContent = `
      #hazard-inspector-container {
        position: absolute;
        top: 60px;
        right: 20px;
        width: 380px;
        max-height: calc(100vh - 90px);
        z-index: 999;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        pointer-events: auto;
      }
      .sri-inspector-panel {
        background: var(--glass-bg, rgba(12, 12, 20, 0.88));
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
        border-radius: var(--panel-radius, 14px);
        color: var(--text-primary, #e8eaed);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .sri-inspector-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
        background: rgba(255, 255, 255, 0.02);
      }
      .sri-header-top {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .sri-header-icon { font-size: 20px; flex-shrink: 0; }
      .sri-header-text { flex: 1; min-width: 0; }
      .sri-header-title {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.8px;
        color: #fff;
        line-height: 1.3;
      }
      .sri-header-subtitle {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        letter-spacing: 0.5px;
        color: var(--accent, #00d4ff);
        margin-top: 2px;
      }
      .sri-close-btn {
        background: none;
        border: none;
        color: var(--text-dim, rgba(232, 234, 237, 0.4));
        font-size: 18px;
        cursor: pointer;
        padding: 0 2px;
        line-height: 1;
        transition: color 150ms ease;
      }
      .sri-close-btn:hover { color: #fff; }
      .sri-badge-row { display: flex; gap: 6px; margin-top: 8px; }
      .sri-tag, .sri-sev-tag {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .sri-inspector-body {
        padding: 12px 16px;
        overflow-y: auto;
        max-height: calc(100vh - 200px);
      }
      .sri-section-title {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--text-dim, rgba(232, 234, 237, 0.4));
        margin: 12px 0 6px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding-bottom: 2px;
      }
      .sri-metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .sri-metric-card {
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.05);
        padding: 6px 8px;
        border-radius: 6px;
      }
      .sri-metric-label {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 7.5px;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--text-dim, rgba(232, 234, 237, 0.4));
        margin-bottom: 2px;
      }
      .sri-metric-val {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent, #00d4ff);
        letter-spacing: 0.5px;
      }
      .sri-metric-val.val-crit { color: #ff3344; }
      .sri-metric-val.val-warn { color: #ffaa00; }
      .sri-metric-unit { font-size: 9px; font-weight: 400; color: var(--text-dim); }
      .sri-actions-list {
        margin: 0;
        padding-left: 14px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        color: var(--text-secondary, rgba(232, 234, 237, 0.7));
      }
      .sri-action-item { margin-bottom: 4px; line-height: 1.4; }
      .sri-responders-list {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        padding: 6px 8px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
      }
      .sri-resp-row { font-size: 8.5px; color: #b0c0d0; margin-bottom: 3px; }
      .sri-prov-box {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.06);
        padding: 6px 8px;
        border-radius: 6px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 8.5px;
        color: var(--text-secondary, rgba(232, 234, 237, 0.65));
      }
      .sri-prov-row { margin-bottom: 2px; }
      .sri-prov-k { color: var(--accent, #00d4ff); }
      .sri-prov-limits { margin-top: 4px; color: #ffaa00; }
      .sri-prov-limits ul { margin: 2px 0 0 0; padding-left: 12px; }
      .sri-dossier-btn {
        margin-top: 12px;
        width: 100%;
        padding: 9px 12px;
        background: rgba(0, 212, 255, 0.1);
        border: 1px solid rgba(0, 212, 255, 0.4);
        border-radius: var(--btn-radius, 8px);
        color: var(--accent, #00d4ff);
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 0 12px rgba(0, 212, 255, 0.15);
        transition: all 150ms ease;
      }
      .sri-dossier-btn:hover {
        background: rgba(0, 212, 255, 0.22);
        border-color: #00d4ff;
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.35);
        color: #fff;
      }
      .sri-inspector-panel.empty {
        padding: 14px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9.5px;
        color: var(--text-dim);
        line-height: 1.45;
      }
      .sri-inspector-title {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 9.5px;
        letter-spacing: 1.5px;
        font-weight: 700;
        color: var(--accent);
      }
    `;
    document.head.appendChild(style);
  }
}
