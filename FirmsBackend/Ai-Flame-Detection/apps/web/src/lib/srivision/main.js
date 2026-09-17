import * as Cesium from 'cesium';
if (typeof window !== 'undefined') window.Cesium = Cesium;
import { StyleManager } from './ui.js';
import { flyToAustin } from './camera.js';
import { DataLayerManager } from './data/manager.js';
import earthquakesLayer from './data/earthquakes.js';
import satellitesLayer from './data/satellites.js';
import localDataLayers from './data/localLayers.js';
import forestIntelligenceLayer from './data/forestIntelligence.js';
import { initForestPanel } from './forestPanel.js';
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
import { LandslideLayer } from './layers/landslideLayer.js';
import { FloodLayer } from './layers/floodLayer.js';
import { HazardInspector } from './ui/panels/hazardInspector.js';
import { AlertBanner } from './ui/alerts/alertBanner.js';
import { DossierModal } from './ui/dossier/dossierModal.js';
import { HazardTooltip } from './ui/hud/hazardTooltip.js';
import { QuickZoneBar } from './ui/hud/quickZoneBar.js';
import { ThreatLegend } from './ui/hud/threatLegend.js';
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

    // Initialize base data layer manager
    const dataManager = new DataLayerManager(viewer, {
      allowQaRegistration: import.meta.env.DEV,
    });
    dataManager.register(earthquakesLayer);
    dataManager.register(forestIntelligenceLayer);
    dataManager.register(satellitesLayer);
    for (const layer of localDataLayers) {
      dataManager.register(layer);
    }
    dataManager.finalizeRegistrations(LAYER_STATE_REGISTRY);
    dataManager.buildTogglePanel(document.getElementById('data-toggles'));
    initForestPanel({ viewer, forestLayer: forestIntelligenceLayer });
    styleManager.attachDataManager(dataManager);

    // ==========================================
    // SRI VISION HAZARD LAYER & UI ORCHESTRATION
    // ==========================================
    const hazardLayerManager = new HazardLayerManager(viewer);
    const wildfireLayer = hazardLayerManager.registerLayer(new WildfireLayer());
    const industrialLayer = hazardLayerManager.registerLayer(new IndustrialLayer());
    const dispersionLayer = hazardLayerManager.registerLayer(new DispersionLayer());
    const landslideLayer = hazardLayerManager.registerLayer(new LandslideLayer());
    const floodLayer = hazardLayerManager.registerLayer(new FloodLayer());

    // Load and render all hazard layers
    void hazardLayerManager.loadAll();

    // Initialize UI Components & Advanced UX HUD
    const hazardInspector = new HazardInspector();
    const alertBanner = new AlertBanner('sri-alert-banner-container', viewer);
    const dossierModal = new DossierModal();
    const hazardTooltip = new HazardTooltip(viewer);
    const quickZoneBar = new QuickZoneBar(viewer, hazardLayerManager);
    const threatLegend = new ThreatLegend();

    // Connect selection events and audio cues
    hazardLayerManager.onHazardSelected((hazard) => {
      tacticalAudio.playAlert();
      hazardInspector.setHazard(hazard);
    });

    alertBanner.onSelectHazard = (hazard) => {
      tacticalAudio.playClick();
      hazardInspector.setHazard(hazard);
      hazardLayerManager.notifyHazardSelected(hazard);
    };

    hazardInspector.onGenerateDossier = (hazard) => {
      tacticalAudio.playClick();
      dossierModal.open(hazard);
    };

    // Initialize Event-Driven Orchestrator
    const eventOrchestrator = new DisasterEventOrchestrator(viewer, hazardLayerManager);

    // Initial alert load triggers via event bus
    setTimeout(() => {
      const initialAlerts = [
        ...(landslideLayer.villages || []).map((v) => ({
          id: `alert-landslide-${v.village_id}`,
          hazard_type: 'LANDSLIDE',
          title: `🏔️ ${v.village_name} Slope Warning`,
          subtitle: `Factor of Safety: ${v.factor_of_safety} · ${v.alert_tier}`,
          severity: v.alert_tier === 'RED_EVACUATE_IMMEDIATE' ? 'CRITICAL' : 'HIGH',
          location: { latitude: v.coordinates.latitude, longitude: v.coordinates.longitude, locality: v.village_name },
        })),
        ...(floodLayer.villages || []).map((v) => ({
          id: `alert-flood-${v.village_id}`,
          hazard_type: 'FLASH_FLOOD',
          title: `🌊 ${v.village_name} Inundation Surge`,
          subtitle: `Surge: +${v.catchment_hydrology?.estimated_inundation_depth_meters || 0}m · ${v.alert_tier}`,
          severity: v.alert_tier === 'RED_FLASH_FLOOD_EVACUATE' ? 'CRITICAL' : 'HIGH',
          location: { latitude: v.coordinates.latitude, longitude: v.coordinates.longitude, locality: v.village_name },
        })),
        {
          id: 'alert-plume-jamnagar',
          hazard_type: 'CHEMICAL_PLUME',
          title: '☁️ Jamnagar Plume Simulation',
          subtitle: 'Benzene Vapor Dispersion · Industrial Sector',
          severity: 'HIGH',
          location: { latitude: 22.4707, longitude: 70.0577, locality: 'Jamnagar' },
        },
      ];
      for (const alert of initialAlerts) {
        eventBus.emit(SRI_EVENTS.ALERT_TRIGGERED, alert);
      }
    }, 1500);

    const sceneDirector = new SceneDirector(viewer, styleManager, dataManager);
    const annotations = initAnnotations({ viewer, tileset });

    void Promise.all([
      styleManager.initialRestorePromise,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]).finally(() => {
      loadingScreen.classList.add('hidden');
      let firstRunRevealed = false;
      const revealFirstRun = () => {
        if (firstRunRevealed) return;
        firstRunRevealed = true;
        initFirstRunExperience({ styleManager, dataManager, hazardLayerManager, viewer });
      };
      loadingScreen.addEventListener('transitionend', revealFirstRun, { once: true });
      setTimeout(revealFirstRun, 900);
    });

    void initKeySetup();
    installRenderGovernor(viewer);
    installScopeMask(viewer);

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

    window.__sriVision = {
      viewer,
      styleManager,
      tileset,
      dataManager,
      hazardLayerManager,
      hazardInspector,
      alertBanner,
      dossierModal,
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
