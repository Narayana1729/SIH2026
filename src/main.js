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
import { QuickZoneBar } from './ui/hud/quickZoneBar.js';
import { SegregationFilterBar } from './ui/hud/segregationFilterBar.js';
import { ThreatLegend } from './ui/hud/threatLegend.js';
import { openFirmsUploadModal } from './ui/ingestion/firmsUploadModal.js';
import { openAiSimulationLabModal } from './ui/simulation/aiSimulationLabModal.js';
import { initAgniVoiceHud, toggleAgniVoiceHud } from './ui/hud/agniVoiceHud.js';
import { openDispatchModal } from './ui/responders/dispatchModal.js';
import { ThermalAnomalyListPanel } from './ui/panels/thermalAnomalyListPanel.js';
import { HistoricalTimelineBar } from './ui/hud/historicalTimelineBar.js';
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
    const quickZoneBar = new QuickZoneBar(viewer, hazardLayerManager);
    const segregationFilterBar = new SegregationFilterBar(hazardLayerManager);
    const threatLegend = new ThreatLegend();
    const historicalTimelineBar = new HistoricalTimelineBar(viewer, dataManager);

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

    initAgniVoiceHud((action) => {
      tacticalAudio.playAlert();
      if (action === 'LIST_MINING') {
        thermalListPanel.open('MINING');
      } else if (action === 'LIST_ALL') {
        thermalListPanel.open('ALL');
      } else if (action === 'LIST_INDUSTRIAL') {
        thermalListPanel.open('INDUSTRIAL');
      } else if (action === 'LIST_AGRICULTURAL') {
        thermalListPanel.open('AGRICULTURAL');
      } else if (action === 'LIST_WILDFIRE') {
        thermalListPanel.open('WILDFIRE');
      } else if (action === 'SHOW_FLARES') {
        const indLayer = hazardLayerManager.getLayer('hazard-industrial');
        if (indLayer) indLayer.show();
      } else if (action === 'ZOOM_JAMNAGAR') {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(70.0577, 22.4707, 18000),
          duration: 2.2
        });
      } else if (action === 'SIMULATE_PLUME') {
        const dispLayer = hazardLayerManager.getLayer('hazard-dispersion');
        if (dispLayer) {
          dispLayer.show();
          dispLayer.simulatePlumeAt(22.4707, 70.0577, { chemical: 'BENZENE', facilityName: 'Jamnagar Flare Outburst' });
        }
      } else if (action === 'OPEN_UPLOAD') {
        openFirmsUploadModal();
      } else if (action === 'OPEN_SIM_LAB') {
        openAiSimulationLabModal();
      } else if (action === 'DISPATCH_EMERGENCY') {
        openDispatchModal({
          lat: 22.4707,
          lon: 70.0577,
          frp: 85.0,
          category: 'Industrial Petrochemical Flare Outburst',
          flameTempC: 1350,
          flameTempK: 1623
        });
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
