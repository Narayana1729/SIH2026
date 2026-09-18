import * as Cesium from 'cesium';
if (typeof window !== 'undefined') window.Cesium = Cesium;
import { StyleManager } from './ui.js';
import { flyToAustin } from './camera.js';
import { DataLayerManager } from './data/manager.js';
import localDataLayers from './data/localLayers.js';
import { LAYER_STATE_REGISTRY } from './data/layerState.js';
import { registerDataCredits } from './data/dataCredits.js';
import { SceneDirector } from './scenes/director.js';
import { initGevVoiceCommands } from './voice/gevRealtime.js';
import { MapStackController } from './mapStackController.js';
import { initAnnotations } from './annotations/index.js';
import { initLogoGaze } from './logoGaze.js';
import { initCockpitCloudEffects } from './cockpitCloudEffects.js';
import {
  installRenderGovernor,
  getRenderGovernorDiagnostics,
  governorRequestRender,
  holdContinuousRender,
  releaseContinuousRender,
} from './renderGovernor.js';
import { installScopeMask } from './scopeMask.js';
import { initFirstRunExperience } from './firstRunExperience.js';
import { initKeySetup } from './keySetup.js';
import { loadPhotorealisticTileset } from './mapStartup.js';

import { HazardLayerManager } from './layers/layerManager.js';
import { WildfireLayer } from './layers/wildfireLayer.js';
import { IndustrialLayer } from './layers/industrialLayer.js';
import { DispersionLayer } from './layers/dispersionLayer.js';
import { HazardInspector } from './ui/panels/hazardInspector.js';
import { AlertBanner } from './ui/alerts/alertBanner.js';
import { DossierModal } from './ui/dossier/dossierModal.js';
import { HazardTooltip } from './ui/hud/hazardTooltip.js';
import { SegregationFilterBar } from './ui/hud/segregationFilterBar.js';
import { ThreatLegend } from './ui/hud/threatLegend.js';
import { openFirmsUploadModal } from './ui/ingestion/firmsUploadModal.js';
import { openAiSimulationLabModal } from './ui/simulation/aiSimulationLabModal.js';
import { initAgniVoiceHud, toggleAgniVoiceHud } from './ui/hud/agniVoiceHud.js';
import { openDispatchModal } from './ui/responders/dispatchModal.js';
import { ThermalAnomalyListPanel } from './ui/panels/thermalAnomalyListPanel.js';
import { HistoricalTimelineBar } from './ui/hud/historicalTimelineBar.js';
import { ZoomSliderBar } from './ui/hud/zoomSliderBar.js';
import { tacticalAudio } from './core/audio.js';
import { eventBus, SRI_EVENTS } from './core/eventBus.js';
import { DisasterEventOrchestrator } from './intelligence/eventOrchestrator.js';

initLogoGaze();

/**
 * Extract a human-readable error message from any thrown value.
 * @param {*} error — caught exception value
 * @returns {string} best-effort error description
 */
function describeError(error) {
  if (!error) return 'Unknown initialization error';
  if (error instanceof Error) {
    if (error.message && error.message.trim()) return error.message.trim();
    return error.name || 'Initialization error';
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object') {
    const maybeMessage = String(error.message || error.error || '').trim();
    if (maybeMessage) return maybeMessage;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // ignore serialization error
    }
  }
  return String(error);
}

/**
 * sriVision — Environmental & Disaster Command Platform Entry Point
 * Initializes CesiumJS 3D globe with Google Photorealistic 3D Tiles,
 * hazard layers, inspector drawer, priority alert queue, and tactical incident dossiers.
 */
async function init() {
  const loadingScreen = document.getElementById('loading-screen');
  const loaderStatus = loadingScreen.querySelector('.loader-status');

  try {
    loaderStatus.textContent = 'Configuring viewer...';

    const cesiumToken = import.meta.env.CESIUM_ION_TOKEN;
    const googleApiKey = import.meta.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey) window.__GOOGLE_MAPS_API_KEY__ = googleApiKey;

    // Create the Cesium viewer
    const viewer = new Cesium.Viewer('cesiumContainer', {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false,
      creditContainer: (() => {
        const el = document.createElement('div');
        el.id = 'cesium-credits';
        document.body.appendChild(el);
        return el;
      })(),
      msaaSamples: 4,
      contextOptions: {
        webgl: {
          preserveDrawingBuffer: true,
        },
      },
    });

    viewer.targetFrameRate = 60;
    registerDataCredits(viewer);

    viewer.scene.globe.show = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.atmosphereLightIntensity = 18;
    viewer.scene.skyAtmosphere.saturationShift = -0.12;
    viewer.scene.skyAtmosphere.brightnessShift = -0.08;

    loaderStatus.textContent = googleApiKey || cesiumToken
      ? 'Loading Google 3D Tiles...'
      : 'Loading the keyless globe...';
    const photoreal = await loadPhotorealisticTileset(Cesium, {
      googleApiKey,
      cesiumToken,
    });
    const tileset = photoreal.tileset;
    if (tileset) {
      viewer.scene.primitives.add(tileset);
      viewer.scene.globe.show = false;
      console.info(`[Init] Google 3D Tiles loaded via ${photoreal.route}.`);
    } else {
      if (photoreal.errors.length) {
        const tileError = photoreal.errors.at(-1);
        console.warn('[Init] Google 3D Tiles unavailable, using the keyless globe:', tileError);
        const tileErrorDetail = describeError(tileError);
        loaderStatus.textContent = `Google 3D Tiles unavailable (${tileErrorDetail}). Loading the keyless globe...`;
      }
      viewer.scene.globe.show = true;
    }

    loaderStatus.textContent = 'Initializing disaster intelligence systems...';

    const mapStackController = new MapStackController(viewer, {
      googleTileset: tileset,
      cesiumToken,
      initialStack: tileset ? 'photoreal' : 'esri-imagery',
      onChange: (state) => {
        window.dispatchEvent(new CustomEvent('srivision:map-stack-changed', { detail: state }));
      },
      onError: (message) => console.warn('[MapStack]', message),
    });
    await mapStackController.setStack(tileset ? 'photoreal' : 'esri-imagery', { silent: true });

    const styleManager = new StyleManager(viewer, { mapStackController });
    const weatherEffects = null;
    const cockpitCloudEffects = initCockpitCloudEffects(viewer);

    if (!styleManager.hasShareState) {
      loaderStatus.textContent = 'Flying to situational overview...';
      flyToAustin(viewer);
    } else {
      loaderStatus.textContent = 'Restoring shared view...';
    }

    // Initialize base data layer manager for PyroSat Industrial & Thermal layers
    const dataManager = new DataLayerManager(viewer, {
      allowQaRegistration: import.meta.env.DEV,
    });
    for (const layer of localDataLayers) {
      dataManager.register(layer);
    }
    dataManager.finalizeRegistrations(LAYER_STATE_REGISTRY);
    dataManager.buildTogglePanel(document.getElementById('data-toggles'));
    styleManager.attachDataManager(dataManager);

    // ==========================================
    // PYROSAT THERMAL HAZARD LAYER ORCHESTRATION
    // ==========================================
    const hazardLayerManager = new HazardLayerManager(viewer);
    const wildfireLayer = hazardLayerManager.registerLayer(new WildfireLayer());
    const industrialLayer = hazardLayerManager.registerLayer(new IndustrialLayer());
    const dispersionLayer = hazardLayerManager.registerLayer(new DispersionLayer());

    // Synchronize data layer toggles with hazard layer manager
    dataManager.subscribe((change) => {
      if (change?.type === 'visibility') {
        if (change.layerId === 'local-industrial') {
          if (change.enabled) industrialLayer.show();
          else industrialLayer.hide();
        } else if (change.layerId === 'local-firms' || change.layerId === 'local-stored-firms') {
          if (change.enabled) wildfireLayer.show();
          else if (!dataManager.isEnabled('local-firms') && !dataManager.isEnabled('local-stored-firms')) {
            wildfireLayer.hide();
          }
        }
      }
    });

    // Enable FIRMS Live Satellite Telemetry by default on startup
    if (!dataManager.isEnabled('local-firms') && !dataManager.isEnabled('local-stored-firms')) {
      void dataManager.setEnabled('local-firms', true, { origin: 'user' }).catch(() => {});
      wildfireLayer.show();
    }
    if (!dataManager.isEnabled('local-industrial')) industrialLayer.hide();

    // Clear layers button handler
    const clearLayersBtn = document.getElementById('clear-selected-layers');
    clearLayersBtn?.addEventListener('click', () => {
      tacticalAudio.playClick();
      hazardLayerManager.getAllLayers().forEach((l) => l.hide());
    });

    // Load and render all hazard layers (they will only show if their respective layer is enabled)
    void hazardLayerManager.loadAll();

    // Initialize UI Components & Advanced UX HUD
    const hazardInspector = new HazardInspector();
    const alertBanner = new AlertBanner('sri-alert-banner-container', viewer);
    const dossierModal = new DossierModal();
    const hazardTooltip = new HazardTooltip(viewer);
    const segregationFilterBar = new SegregationFilterBar(hazardLayerManager);
    const threatLegend = new ThreatLegend();
    const historicalTimelineBar = new HistoricalTimelineBar(viewer, dataManager);
    const zoomSliderBar = new ZoomSliderBar(viewer);

    // Connect selection events, camera flight, and audio cues
    let lastHandledHazardId = null;
    const handleHazardFocus = (hazard) => {
      if (!hazard) return;
      const hId = hazard.id || `${hazard.location?.latitude}_${hazard.location?.longitude}`;
      if (lastHandledHazardId === hId) return;
      lastHandledHazardId = hId;
      setTimeout(() => { lastHandledHazardId = null; }, 500);

      tacticalAudio.playAlert();
      if (hazard?.location?.latitude && hazard?.location?.longitude) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            hazard.location.longitude,
            hazard.location.latitude,
            hazard.location.altitude || 14000
          ),
          duration: 1.8,
        });
      }
      hazardInspector.setHazard(hazard);
    };

    hazardLayerManager.onHazardSelected(handleHazardFocus);
    eventBus.on(SRI_EVENTS.HAZARD_SELECTED, handleHazardFocus);

    alertBanner.onSelectHazard = (hazard) => {
      handleHazardFocus(hazard);
      hazardLayerManager.notifyHazardSelected(hazard);
    };

    hazardInspector.onGenerateDossier = (hazard) => {
      tacticalAudio.playClick();
      dossierModal.open(hazard);
    };

    // Initialize Event-Driven Orchestrator
    const eventOrchestrator = new DisasterEventOrchestrator(viewer, hazardLayerManager);


    const sceneDirector = new SceneDirector(viewer, styleManager, dataManager);
    const annotations = initAnnotations({ viewer, tileset });

    void Promise.all([
      styleManager.initialRestorePromise,
    ]).finally(() => {
      loadingScreen.classList.add('hidden');
      let firstRunRevealed = false;
      const revealFirstRun = () => {
        if (firstRunRevealed) return;
        firstRunRevealed = true;
        initFirstRunExperience({ styleManager, dataManager, hazardLayerManager, viewer });
      };
      loadingScreen.addEventListener('transitionend', revealFirstRun, { once: true });
      setTimeout(revealFirstRun, 200);
    });

    void initKeySetup();
    installRenderGovernor(viewer);

    viewer.trackedEntityChanged.addEventListener(() => {
      if (viewer.trackedEntity) holdContinuousRender('tracked-entity');
      else releaseContinuousRender('tracked-entity');
    });

    const syncVisibilitySuspension = () => {
      const hidden = document.hidden;
      viewer.useDefaultRenderLoop = !hidden;
      cockpitCloudEffects?.setSuspended?.(hidden);
      if (!hidden) {
        if (dataManager._panelRefreshPendingOnVisible) {
          dataManager._panelRefreshPendingOnVisible = false;
          dataManager._refreshTogglePanel();
        }
        governorRequestRender('visibility-restore');
      }
    };
    document.addEventListener('visibilitychange', syncVisibilitySuspension);
    syncVisibilitySuspension();

    // Setup Interactive Modals & Voice HUD
    document.getElementById('btn-upload-firms')?.addEventListener('click', () => {
      tacticalAudio.playClick();
      openFirmsUploadModal((importedHazards) => {
        const wildfireLayer = hazardLayerManager.getLayer('hazard-wildfire');
        if (wildfireLayer) {
          wildfireLayer.show();
        }
      });
    });

    const thermalListPanel = new ThermalAnomalyListPanel(viewer, hazardLayerManager, hazardInspector);

    document.getElementById('btn-sim-lab')?.addEventListener('click', () => {
      tacticalAudio.playClick();
      openAiSimulationLabModal();
    });

    document.getElementById('btn-thermal-registry')?.addEventListener('click', () => {
      tacticalAudio.playClick();
      thermalListPanel.open('ALL');
    });

    document.getElementById('btn-voice-hud')?.addEventListener('click', () => {
      tacticalAudio.playClick();
      toggleAgniVoiceHud();
    });

    const bindDockVoiceButton = () => {
      const dockBtn = document.getElementById('gev-voice-button');
      if (dockBtn) {
        dockBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          tacticalAudio.playClick();
          toggleAgniVoiceHud();
        }, { capture: true });
      }
    };
    bindDockVoiceButton();
    setTimeout(bindDockVoiceButton, 500);

    initAgniVoiceHud((cmd) => {
      tacticalAudio.playAlert();
      const action = typeof cmd === 'string' ? cmd : cmd?.action;
      const filters = cmd?.filters || {};
      const mapAction = cmd?.map_action;

      // 1. Filtering thermal events on 3D globe AND registry panels
      if (action === 'FILTER_THERMAL_EVENTS' || action?.startsWith('LIST_')) {
        const cat = (filters.category || '').toUpperCase();
        const classification = (filters.classification || '').toUpperCase();

        // Map voice/NLU categories to the WildfireLayer filter keys
        let globeFilterKey = 'ALL';
        let panelCategory = 'ALL';

        if (action === 'LIST_MINING' || cat.includes('MIN') || cat.includes('COAL')) {
          globeFilterKey = 'MINING_SMELTING';
          panelCategory = 'MINING';
        } else if (action === 'LIST_AGRICULTURAL' || cat.includes('CROP') || cat.includes('STUBBLE') || cat.includes('AGRI')) {
          globeFilterKey = 'AGRICULTURAL_BURNING';
          panelCategory = 'AGRICULTURAL';
        } else if (action === 'LIST_WILDFIRE' || cat.includes('WILD') || cat.includes('FOREST')) {
          globeFilterKey = 'FOREST_WILDFIRE';
          panelCategory = 'WILDFIRE';
        } else if (action === 'LIST_INDUSTRIAL' || cat.includes('IND') || cat.includes('REFIN') || cat.includes('FLARE') || classification === 'INDUSTRIAL') {
          globeFilterKey = 'INDUSTRIAL';
          panelCategory = 'INDUSTRIAL';
        } else if (classification === 'NON_INDUSTRIAL') {
          globeFilterKey = 'NON_INDUSTRIAL';
          panelCategory = 'ALL';
        }

        // A) Apply filter on the 3D globe map — this is the critical missing step
        const wfLayer = hazardLayerManager.getLayer('hazard-wildfire');
        if (wfLayer?.applyCategoryFilter) {
          wfLayer.applyCategoryFilter(globeFilterKey, { flyTo: false });
        }
        // Also broadcast via event bus so any other listeners sync up
        eventBus.emit(SRI_EVENTS.CATEGORY_FILTER_CHANGED, { category: globeFilterKey, flyTo: false });

        // B) Sync the SegregationFilterBar chip UI to reflect the active voice filter
        if (segregationFilterBar) {
          segregationFilterBar.activeFilter = globeFilterKey;
          segregationFilterBar.container.querySelectorAll('.sri-filter-chip').forEach((btn) => {
            const catId = btn.getAttribute('data-cat-id');
            if (catId === globeFilterKey) btn.classList.add('active');
            else btn.classList.remove('active');
          });
        }

        // C) Open the thermal list panel with the corresponding panel category
        thermalListPanel.open(panelCategory);

        // D) Fly camera to requested state/region if specified
        const stateFilter = (filters.state || '').toUpperCase().trim();
        if (stateFilter) {
          const STATE_COORDS = {
            'TELANGANA': { lon: 79.0193, lat: 18.1124, height: 420000 },
            'ANDHRA PRADESH': { lon: 79.7400, lat: 15.9129, height: 520000 },
            'GUJARAT': { lon: 71.1924, lat: 22.2587, height: 480000 },
            'MAHARASHTRA': { lon: 75.7139, lat: 19.7515, height: 550000 },
            'ODISHA': { lon: 84.0167, lat: 20.9517, height: 450000 },
            'JHARKHAND': { lon: 85.2799, lat: 23.6102, height: 380000 },
            'CHHATTISGARH': { lon: 81.8661, lat: 21.2787, height: 450000 },
            'KARNATAKA': { lon: 75.7139, lat: 15.3173, height: 500000 },
            'TAMIL NADU': { lon: 78.6569, lat: 11.1271, height: 480000 },
            'RAJASTHAN': { lon: 73.7684, lat: 27.0238, height: 600000 },
            'MADHYA PRADESH': { lon: 78.6569, lat: 23.4734, height: 580000 },
            'WEST BENGAL': { lon: 87.8550, lat: 22.9868, height: 450000 },
            'PUNJAB': { lon: 75.3412, lat: 31.1471, height: 350000 },
            'HARYANA': { lon: 76.0856, lat: 29.0588, height: 350000 },
            'ASSAM': { lon: 92.9376, lat: 26.2006, height: 400000 },
            'KERALA': { lon: 76.2711, lat: 10.8505, height: 380000 },
            'UTTAR PRADESH': { lon: 80.9462, lat: 26.8467, height: 600000 },
            'BIHAR': { lon: 85.3131, lat: 25.0961, height: 400000 },
            'GOA': { lon: 74.1240, lat: 15.2993, height: 200000 },
          };
          const coords = STATE_COORDS[stateFilter];
          if (coords) {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(coords.lon, coords.lat, coords.height),
              duration: 1.8
            });
          }
        }
      }

      // 2. Geospatial camera & map mode actions
      else if (action === 'MAP_ACTION') {
        if (mapAction === 'RECENTER_INDIA' || mapAction === 'RESET_VIEW') {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 3200000),
            duration: 1.8
          });
        } else if (mapAction === 'ZOOM_IN') {
          viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.35);
        } else if (mapAction === 'ZOOM_OUT') {
          viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.4);
        } else if (mapAction === 'SET_VIEW_MODE') {
          if (cmd.view_mode === '2D') {
            viewer.scene.morphTo2D(1.0);
          } else {
            viewer.scene.morphTo3D(1.0);
          }
        }
      }

      // 3. Incident selection & Flying
      else if (action === 'SELECT_INCIDENT' || action === 'ZOOM_JAMNAGAR') {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(70.0577, 22.4707, 18000),
          duration: 2.2
        });
      }

      // 4. Hazard simulation (Gaussian Plume)
      else if (action === 'SHOW_HAZARD' || action === 'SIMULATE_PLUME') {
        const dispLayer = hazardLayerManager.getLayer('hazard-dispersion');
        if (dispLayer) {
          dispLayer.show();
          dispLayer.simulatePlumeAt(22.4707, 70.0577, { chemical: 'BENZENE', facilityName: 'Jamnagar Flare Outburst' });
        }
      }

      // 5. Explainable AI Feature Attribution (TreeSHAP)
      else if (action === 'OPEN_XAI') {
        const indLayer = hazardLayerManager.getLayer('hazard-industrial');
        const sample = indLayer?.hotspots?.[0];
        if (sample) {
          hazardInspector.setHazard(sample);
        }
        setTimeout(() => {
          const xaiBtn = document.querySelector('[data-tab="xai"]') || document.querySelector('.xai-trigger-btn');
          if (xaiBtn) xaiBtn.click();
        }, 300);
      }

      // 6. Simulation Lab
      else if (action === 'OPEN_SIMULATION_LAB' || action === 'OPEN_SIM_LAB') {
        openAiSimulationLabModal();
      }

      // 7. Tactical Dossier / Incident Action Plan (IAP)
      else if (action === 'OPEN_DOSSIER') {
        if (dossierModal && typeof dossierModal.open === 'function') {
          dossierModal.open();
        }
      }

      // 8. Emergency Dispatch Modal (Fast2SMS / Responders)
      else if (action === 'DISPATCH_PREVIEW' || action === 'DISPATCH_EMERGENCY') {
        openDispatchModal({
          lat: 22.4707,
          lon: 70.0577,
          frp: 85.0,
          category: 'Industrial Petrochemical Flare Outburst',
          flameTempC: 1350,
          flameTempK: 1623
        });
      }

      // 9. NASA FIRMS CSV Upload Modal
      else if (action === 'OPEN_UPLOAD') {
        openFirmsUploadModal();
      }

      // 10. GIS & Infrastructure Layer Toggle
      else if (action === 'LAYER_TOGGLE' || action === 'SHOW_FLARES') {
        const layerKey = cmd?.layer || 'hazard-industrial';
        const layer = hazardLayerManager.getLayer(layerKey);
        if (layer) {
          if (cmd?.layer_action === 'HIDE') layer.hide();
          else layer.show();
        }
      }

      // 11. Clear all filters — reset globe to ALL detections
      else if (action === 'CLEAR_FILTERS') {
        const wfLayer = hazardLayerManager.getLayer('hazard-wildfire');
        if (wfLayer?.applyCategoryFilter) {
          wfLayer.applyCategoryFilter('ALL', { flyTo: false });
        }
        eventBus.emit(SRI_EVENTS.CATEGORY_FILTER_CHANGED, { category: 'ALL', flyTo: false });
        if (segregationFilterBar) {
          segregationFilterBar.activeFilter = 'ALL';
          segregationFilterBar.container.querySelectorAll('.sri-filter-chip').forEach((btn) => {
            const catId = btn.getAttribute('data-cat-id');
            if (catId === 'ALL') btn.classList.add('active');
            else btn.classList.remove('active');
          });
        }
        thermalListPanel.open('ALL');
      }
    });

    window.__sriVision = {
      viewer,
      styleManager,
      tileset,
      dataManager,
      hazardLayerManager,
      hazardInspector,
      alertBanner,
      dossierModal,
      thermalListPanel,
      historicalTimelineBar,
      segregationFilterBar,
      zoomSliderBar,
      flyToPilotSector: (sector) => {
        tacticalAudio.playClick();
        let target = { lon: 69.870, lat: 22.380, height: 18000 };
        let hazardTitle = 'Jamnagar Petrochemical Complex (Measured 10m Tile)';
        if (sector === 'similipal') {
          target = { lon: 86.330, lat: 21.850, height: 22000 };
          hazardTitle = 'Similipal Forest Reserve Fire (Measured 10m Tile)';
        } else if (sector === 'karnal') {
          target = { lon: 76.980, lat: 29.680, height: 22000 };
          hazardTitle = 'Karnal Agricultural Burning (Measured 10m Tile)';
        }
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.height),
          duration: 1.8,
        });
        const wildfireLayer = hazardLayerManager.getLayer('hazard-wildfire');
        const found = wildfireLayer?.hotspots?.find((h) => {
          const lat = h.location?.latitude ?? h.latitude;
          const lon = h.location?.longitude ?? h.longitude;
          return Math.abs(lat - target.lat) < 0.25 && Math.abs(lon - target.lon) < 0.25;
        });
        if (found) {
          hazardLayerManager.notifyHazardSelected(found);
        } else {
          hazardInspector.setHazard({
            id: `pilot-${sector}`,
            title: hazardTitle,
            hazard_type: sector === 'jamnagar' ? 'INDUSTRIAL_FIRE' : sector === 'similipal' ? 'WILDFIRE' : 'AGRICULTURAL_FIRE',
            location: { latitude: target.lat, longitude: target.lon, altitude: 0 },
            frp: sector === 'jamnagar' ? 65.0 : sector === 'similipal' ? 120.0 : 45.0,
            bright_ti4: 355.0,
            bright_ti5: 298.0,
            satellite: 'NOAA-20 VIIRS NRT',
            severity: sector === 'jamnagar' ? 'CRITICAL' : 'HIGH',
            actions: ['Ground-truth validated against 10m ESA WorldCover & Sentinel-2 MSI Level-2A surface reflectance.'],
          });
        }
      },
      openAnomalyListPanel: (cat) => thermalListPanel.open(cat),
      openFirmsUploadModal,
      openAiSimulationLabModal,
      openDispatchModal,
      toggleAgniVoiceHud,
      sceneDirector,
      mapStackController,
      annotations,
      weatherEffects,
      cockpitCloudEffects,
      getRenderGovernorDiagnostics,
      requestRender: governorRequestRender,
    };
    window.__sriVision.voiceCommands = initGevVoiceCommands({ viewer, styleManager, dataManager, sceneDirector, annotations });

  } catch (error) {
    console.error("sriVision initialization failed:", error);
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
  }
}

init();
