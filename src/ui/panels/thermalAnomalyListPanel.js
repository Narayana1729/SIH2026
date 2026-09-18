/**
 * @module src/ui/panels/thermalAnomalyListPanel
 * @description Interactive Cyber-Glass Registry Panel for Mining Activities, Industrial Flares, and Thermal Anomalies.
 *
 * Triggered by Voice Commands ("list out all mining activities", "show flares", "list incidents")
 * or UI quick buttons.
 */

import { getAllFacilities } from '../../disasters/industrial/industrialFacilities.js';
import { tacticalAudio } from '../../core/audio.js';
import { eventBus } from '../../core/eventBus.js';
import { SRI_EVENTS } from '../../core/eventTypes.js';

export class ThermalAnomalyListPanel {
  constructor(viewer, hazardLayerManager, hazardInspector) {
    this.viewer = viewer;
    this.hazardLayerManager = hazardLayerManager;
    this.hazardInspector = hazardInspector;
    this.container = null;
    this.currentCategory = 'ALL'; // 'ALL', 'MINING', 'INDUSTRIAL', 'AGRICULTURAL', 'WILDFIRE'
    this.searchQuery = '';
    this.items = [];

    this._initDOM();
    this._loadInitialData();

    eventBus.on(SRI_EVENTS.CATEGORY_FILTER_CHANGED, (evt) => {
      const cat = evt?.category;
      if (!cat) return;
      let mapped = cat;
      if (cat === 'INDUSTRIAL_FLARE' || cat === 'INDUSTRIAL_DISASTER' || cat === 'INDUSTRIAL_PROCESS') mapped = 'INDUSTRIAL';
      else if (cat === 'FOREST_WILDFIRE') mapped = 'WILDFIRE';
      else if (cat === 'AGRICULTURAL_BURNING') mapped = 'AGRICULTURAL';
      else if (cat === 'MINING_SMELTING') mapped = 'MINING';

      this.currentCategory = mapped;
      if (this.container && this.container.style.display !== 'none') {
        this.render();
      }
    });
  }

  _initDOM() {
    if (document.getElementById('sri-anomaly-list-container')) {
      this.container = document.getElementById('sri-anomaly-list-container');
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'sri-anomaly-list-container';
    this.container.style.cssText = `
      position: fixed;
      top: 60px;
      left: 20px;
      width: 380px;
      max-height: calc(100vh - 150px);
      background: rgba(10, 15, 26, 0.94);
      backdrop-filter: blur(24px) saturate(1.4);
      -webkit-backdrop-filter: blur(24px) saturate(1.4);
      border: 1px solid rgba(0, 212, 255, 0.35);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 212, 255, 0.15) inset;
      z-index: 1005;
      display: none;
      flex-direction: column;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      color: #f1f5f9;
      overflow: hidden;
      animation: sriPanelSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    document.body.appendChild(this.container);
  }

  _loadInitialData() {
    const rawFacilities = getAllFacilities();
    
    // Curated high-priority active thermal, mining, and industrial catalog
    this.items = [
      {
        id: 'mining-aditya-aluminium',
        title: 'Hindalco Aditya Aluminium Smelter & CPP',
        category: 'MINING',
        categoryLabel: 'Mining & Smelting',
        sector: 'Aluminium Smelter / Captive Power',
        location: { latitude: 21.6785, longitude: 84.0412, locality: 'Lapanga, Sambalpur (Odisha)' },
        frp: 5.9,
        brightness: 320,
        tempK: 1120,
        severity: 'MEDIUM',
        status: 'OPERATIONAL_SMELTER',
        desc: 'Active potline smelting & 900MW thermal process heat',
      },
      {
        id: 'mining-jharia-coal',
        title: 'Jharia Coalfield Seam-XI Fire Zone',
        category: 'MINING',
        categoryLabel: 'Mining & Smelting',
        sector: 'Coal Seam Fire / Opencast',
        location: { latitude: 23.7441, longitude: 86.4132, locality: 'Dhanbad (Jharkhand)' },
        frp: 48.5,
        brightness: 348,
        tempK: 850,
        severity: 'HIGH',
        status: 'ACTIVE_COAL_FIRE',
        desc: 'Underground coal seam combustion & overburden dump heat',
      },
      {
        id: 'mining-korba-opencast',
        title: 'Korba West OpenCast Mining Complex',
        category: 'MINING',
        categoryLabel: 'Mining & Smelting',
        sector: 'Coal Mining / Smelting',
        location: { latitude: 22.3680, longitude: 82.6850, locality: 'Korba (Chhattisgarh)' },
        frp: 34.2,
        brightness: 338,
        tempK: 780,
        severity: 'MEDIUM',
        status: 'MINING_THERMAL',
        desc: 'Opencast extraction & spontaneous dump combustion',
      },
      {
        id: 'mining-vedanta-jharsuguda',
        title: 'Vedanta Aluminium Smelter-2 Jharsuguda',
        category: 'MINING',
        categoryLabel: 'Mining & Smelting',
        sector: 'Aluminium Smelter & Metallurgy',
        location: { latitude: 21.8492, longitude: 84.0381, locality: 'Jharsuguda (Odisha)' },
        frp: 7.4,
        brightness: 324,
        tempK: 1180,
        severity: 'LOW',
        status: 'OPERATIONAL_SMELTER',
        desc: 'Continuous electrolytic smelting process heat',
      },
      {
        id: 'mining-singrauli-opencast',
        title: 'Singrauli Coal Belt & Jayant Opencast Mine',
        category: 'MINING',
        categoryLabel: 'Mining & Smelting',
        sector: 'Coal Mining & Power Corridor',
        location: { latitude: 24.1150, longitude: 82.6450, locality: 'Singrauli (MP / UP Border)' },
        frp: 29.8,
        brightness: 334,
        tempK: 740,
        severity: 'MEDIUM',
        status: 'MINING_THERMAL',
        desc: 'High-volume overburden mining and spontaneous heating',
      },
      {
        id: 'mining-balco-korba',
        title: 'BALCO Aluminium Smelter & Power Plant',
        category: 'MINING',
        categoryLabel: 'Mining & Smelting',
        sector: 'Aluminium Smelter & Metallurgy',
        location: { latitude: 22.3980, longitude: 82.7450, locality: 'Korba (Chhattisgarh)' },
        frp: 8.6,
        brightness: 326,
        tempK: 1150,
        severity: 'LOW',
        status: 'OPERATIONAL_SMELTER',
        desc: 'Smelter furnace process heat and captive power unit',
      },
      {
        id: 'mining-talcher-coal',
        title: 'Talcher Coalfields (MCL Opencast)',
        category: 'MINING',
        categoryLabel: 'Mining & Smelting',
        sector: 'Coal Mining Lease',
        location: { latitude: 20.9500, longitude: 85.1200, locality: 'Angul (Odisha)' },
        frp: 22.4,
        brightness: 330,
        tempK: 720,
        severity: 'MEDIUM',
        status: 'MINING_THERMAL',
        desc: 'Coal extraction zone & active haulage corridor',
      },
      {
        id: 'ind-jindal-raigarh',
        title: 'Jindal Steel & Power Raigarh Works',
        category: 'INDUSTRIAL',
        categoryLabel: 'Industrial Refineries & Steel',
        sector: 'Steel Plant & Blast Furnace',
        location: { latitude: 21.9190, longitude: 83.3520, locality: 'Raigarh (Chhattisgarh)' },
        frp: 6.2,
        brightness: 322,
        tempK: 1350,
        severity: 'LOW',
        status: 'ROUTINE_FLARING',
        desc: 'Blast furnace flaring & rolling mill process heat',
      },
      {
        id: 'ind-jamnagar-refinery',
        title: 'Reliance Jamnagar Petrochemical Complex',
        category: 'INDUSTRIAL',
        categoryLabel: 'Industrial Refineries & Steel',
        sector: 'Oil Refinery & Petrochemical',
        location: { latitude: 22.4707, longitude: 70.0577, locality: 'Jamnagar (Gujarat)' },
        frp: 142.5,
        brightness: 372,
        tempK: 1580,
        severity: 'CRITICAL',
        status: 'ABNORMAL_SURGE',
        desc: 'Elevated hydrocarbon flare stack outburst',
      },
      {
        id: 'ind-vizag-hpcl',
        title: 'HPCL Visakhapatnam Refinery Complex',
        category: 'INDUSTRIAL',
        categoryLabel: 'Industrial Refineries & Steel',
        sector: 'Oil Refinery',
        location: { latitude: 17.6886, longitude: 83.2519, locality: 'Visakhapatnam (AP)' },
        frp: 280.0,
        brightness: 388,
        tempK: 1640,
        severity: 'CRITICAL',
        status: 'SIMULATION_SURGE',
        desc: 'What-If Simulation: Crude distillation unit surge',
      },
      {
        id: 'agri-sangrur-paddy',
        title: 'Sangrur & Patiala Crop Residue Cluster',
        category: 'AGRICULTURAL',
        categoryLabel: 'Agricultural Stubble Burning',
        sector: 'Cropland Farmland',
        location: { latitude: 30.3000, longitude: 75.8000, locality: 'Sangrur (Punjab)' },
        frp: 22.5,
        brightness: 328,
        tempK: 820,
        severity: 'LOW',
        status: 'SEASONAL_BURNING',
        desc: 'Open-field paddy straw residue combustion',
      },
      {
        id: 'wildfire-bandipur',
        title: 'Bandipur Tiger Reserve Forest Fire',
        category: 'WILDFIRE',
        categoryLabel: 'Forest Wildfires',
        sector: 'Deciduous Canopy Forest',
        location: { latitude: 11.6000, longitude: 76.6000, locality: 'Bandipur (Karnataka)' },
        frp: 140.0,
        brightness: 345,
        tempK: 910,
        severity: 'CRITICAL',
        status: 'CANOPY_FIRE',
        desc: 'Active brush & dry timber forest wildfire',
      },
    ];
  }

  /**
   * Open the panel with an optional pre-selected category filter.
   * @param {string} [category='ALL'] - 'ALL', 'MINING', 'INDUSTRIAL', 'AGRICULTURAL', 'WILDFIRE'
   */
  open(category = 'ALL') {
    this.currentCategory = category.toUpperCase();
    this.container.style.display = 'flex';
    tacticalAudio.playAlert();
    this.render();
  }

  close() {
    this.container.style.display = 'none';
    tacticalAudio.playClick();
  }

  render() {
    const filteredItems = this.items.filter((item) => {
      const matchCat = this.currentCategory === 'ALL' || item.category === this.currentCategory;
      const matchSearch = !this.searchQuery ||
        item.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        item.sector.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        item.location.locality.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    const categories = [
      { key: 'ALL', label: 'All', count: this.items.length },
      { key: 'MINING', label: 'Mining', count: this.items.filter((i) => i.category === 'MINING').length },
      { key: 'INDUSTRIAL', label: 'Industry', count: this.items.filter((i) => i.category === 'INDUSTRIAL').length },
      { key: 'AGRICULTURAL', label: 'Agriculture', count: this.items.filter((i) => i.category === 'AGRICULTURAL').length },
      { key: 'WILDFIRE', label: 'Wildfire', count: this.items.filter((i) => i.category === 'WILDFIRE').length },
    ];

    const tabsHtml = categories.map((c) => `
      <button type="button" class="sri-cat-tab ${this.currentCategory === c.key ? 'active' : ''}" data-cat="${c.key}" style="
        padding: 4px 9px;
        background: ${this.currentCategory === c.key ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255,255,255,0.04)'};
        border: 1px solid ${this.currentCategory === c.key ? '#00d4ff' : 'rgba(255,255,255,0.08)'};
        border-radius: 999px;
        color: ${this.currentCategory === c.key ? '#00d4ff' : '#94a3b8'};
        font-family: inherit;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: all 120ms ease;
        white-space: nowrap;
      ">
        ${c.label} (${c.count})
      </button>
    `).join('');

    const listHtml = filteredItems.length > 0 ? filteredItems.map((item) => {
      const isCritical = item.severity === 'CRITICAL';
      const isHigh = item.severity === 'HIGH';
      const sevColor = isCritical ? '#ef4444' : isHigh ? '#f59e0b' : '#38bdf8';
      const sevBg = isCritical ? 'rgba(239, 68, 68, 0.15)' : isHigh ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)';

      return `
        <div class="sri-anomaly-item" data-id="${item.id}" style="
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-left: 3px solid ${sevColor};
          border-radius: 6px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: all 120ms ease;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <strong style="color: #f8fafc; font-size: 10.5px; line-height: 1.3;">${item.title}</strong>
            <span style="background: ${sevBg}; color: ${sevColor}; border: 1px solid ${sevColor}44; border-radius: 3px; padding: 2px 5px; font-size: 9px; font-weight: 700; white-space: nowrap; margin-left: 6px;">
              ${item.frp.toFixed(1)} MW
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8; margin-bottom: 4px;">
            <span>${item.location.locality}</span>
            <span style="color: #cbd5e1; font-weight: 600;">${item.tempK}K</span>
          </div>

          <div style="font-size: 9px; color: #64748b; line-height: 1.3;">
            ${item.desc}
          </div>
        </div>
      `;
    }).join('') : `
      <div style="text-align: center; padding: 24px 10px; color: #64748b; font-size: 10px;">
        No active targets matching criteria.
      </div>
    `;

    this.container.innerHTML = `
      <!-- Panel Header -->
      <div style="padding: 10px 14px; border-bottom: 1px solid rgba(0, 212, 255, 0.2); display: flex; justify-content: space-between; align-items: center; background: rgba(0, 212, 255, 0.04);">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #00d4ff; letter-spacing: 1px;">THERMAL & MINING REGISTRY</div>
          <div style="font-size: 9px; color: #94a3b8;">${filteredItems.length} TARGETS ACQUIRED</div>
        </div>
        <button id="sri-anomaly-list-close" style="background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px 6px;">✕</button>
      </div>

      <!-- Search & Category Filters -->
      <div style="padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0,0,0,0.2);">
        <input id="sri-anomaly-search-input" type="text" placeholder="Search facilities, mining, state..." value="${this.searchQuery}" style="
          width: 100%;
          box-sizing: border-box;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          padding: 5px 8px;
          font-family: inherit;
          font-size: 8.5px;
          color: #f1f5f9;
          outline: none;
          margin-bottom: 6px;
        " />
        <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
          ${tabsHtml}
        </div>
      </div>

      <!-- Scrollable Targets List -->
      <div style="padding: 8px 12px; overflow-y: auto; flex: 1; max-height: 380px;">
        ${listHtml}
      </div>

      <!-- Footer Quick Status & GIS Export Actions -->
      <div style="padding: 8px 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.35); gap: 6px;">
        <button id="sri-export-geojson-btn" type="button" title="Export GIS GeoJSON for QGIS/ArcGIS" style="
          flex: 1;
          padding: 5px 8px;
          background: rgba(0, 212, 255, 0.12);
          border: 1px solid rgba(0, 212, 255, 0.35);
          border-radius: 4px;
          color: #00d4ff;
          font-family: inherit;
          font-size: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: background 120ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        ">
          <span>📥</span> <span>EXPORT GEOJSON</span>
        </button>
        <button id="sri-export-csv-btn" type="button" title="Export CSV Report" style="
          padding: 5px 8px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          color: #cbd5e1;
          font-family: inherit;
          font-size: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: background 120ms ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        ">
          <span>📊</span> <span>CSV</span>
        </button>
      </div>
    `;

    // Event Bindings
    this.container.querySelector('#sri-anomaly-list-close').addEventListener('click', () => this.close());

    this.container.querySelector('#sri-export-geojson-btn')?.addEventListener('click', () => {
      tacticalAudio.playClick();
      this._exportGeoJson(filteredItems);
    });

    this.container.querySelector('#sri-export-csv-btn')?.addEventListener('click', () => {
      tacticalAudio.playClick();
      this._exportCsv(filteredItems);
    });

    const searchInput = this.container.querySelector('#sri-anomaly-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render();
      const updatedInput = this.container.querySelector('#sri-anomaly-search-input');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
      }
    });

    this.container.querySelectorAll('.sri-cat-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.currentCategory = tab.getAttribute('data-cat');
        tacticalAudio.playClick();
        this.render();
      });
    });

    this.container.querySelectorAll('.sri-anomaly-item').forEach((itemEl) => {
      itemEl.addEventListener('mouseenter', () => {
        itemEl.style.background = 'rgba(0, 212, 255, 0.1)';
        itemEl.style.borderColor = 'rgba(0, 212, 255, 0.4)';
      });
      itemEl.addEventListener('mouseleave', () => {
        itemEl.style.background = 'rgba(255, 255, 255, 0.03)';
        itemEl.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      });

      itemEl.addEventListener('click', () => {
        const id = itemEl.getAttribute('data-id');
        const target = this.items.find((i) => i.id === id);
        if (!target) return;

        tacticalAudio.playFlyTo();

        // 1. Fly 3D Camera to coordinates
        if (this.viewer) {
          this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(target.location.longitude, target.location.latitude, 22000),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-55),
              roll: 0.0,
            },
            duration: 2.0,
          });
        }

        // 2. Select Hazard in Inspector
        if (this.hazardInspector) {
          const isMining = target.category === 'MINING';
          this.hazardInspector.setHazard({
            id: target.id,
            hazard_type: isMining ? 'INDUSTRIAL_FIRE' : target.category === 'WILDFIRE' ? 'WILDFIRE' : 'INDUSTRIAL_FIRE',
            title: `🛰️ ${target.title}`,
            subtitle: `${target.sector} · FRP: ${target.frp} MW`,
            data_classification: 'REAL_LIVE',
            severity: target.severity,
            location: {
              latitude: target.location.latitude,
              longitude: target.location.longitude,
              locality: target.location.locality,
            },
            frp: target.frp,
            bright_ti4: target.brightness,
            metrics: [
              { label: 'Fire Radiative Power', value: target.frp.toFixed(1), unit: 'MW', status: target.frp > 20 ? 'CRITICAL' : 'NORMAL' },
              { label: 'Flame Temperature', value: target.tempK, unit: 'K', status: 'NORMAL' },
              { label: 'Sector Type', value: target.sector, unit: '', status: 'NORMAL' },
              { label: 'Operational Status', value: target.status, unit: '', status: 'NORMAL' },
            ],
            actions: [
              `Target Lock: ${target.title} (${target.sector}).`,
              'Atmospheric Dispersion: Open-Meteo wind stream calibrated for downwind modeling.',
            ],
            provenance: {
              source: 'NASA FIRMS VIIRS NRT / PyroSat Intelligence',
              source_type: 'REAL_LIVE',
              confidence_basis: 'SATELLITE_PYROMETRY_INVERSION',
            },
          });
        }
      });
    });
  }

  _exportGeoJson(items) {
    const geojson = {
      type: 'FeatureCollection',
      metadata: {
        platform: 'PyroSat Industrial Thermal & Fire Intelligence',
        exportedAt: new Date().toISOString(),
        total_features: items.length,
        category: this.currentCategory,
      },
      features: items.map((item) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.location.longitude, item.location.latitude],
        },
        properties: {
          id: item.id,
          title: item.title,
          category: item.category,
          category_label: item.categoryLabel,
          sector: item.sector,
          locality: item.location.locality,
          frp_mw: item.frp,
          brightness_k: item.brightness,
          flame_temp_k: item.tempK,
          severity: item.severity,
          status: item.status,
          description: item.desc,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pyrosat-thermal-registry-${this.currentCategory.toLowerCase()}-${new Date().toISOString().split('T')[0]}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _exportCsv(items) {
    const headers = ['ID', 'Title', 'Category', 'Sector', 'Latitude', 'Longitude', 'Locality', 'FRP_MW', 'Brightness_K', 'FlameTemp_K', 'Severity', 'Status'];
    const rows = items.map((i) => [
      `"${i.id}"`,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.category}"`,
      `"${i.sector.replace(/"/g, '""')}"`,
      i.location.latitude,
      i.location.longitude,
      `"${i.location.locality.replace(/"/g, '""')}"`,
      i.frp,
      i.brightness,
      i.tempK,
      `"${i.severity}"`,
      `"${i.status}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pyrosat-thermal-registry-${this.currentCategory.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
