/**
 * @module core/cesium
 * @description Cesium 3D Globe initialization, terrain elevation, and layer management.
 */

import * as Cesium from 'cesium';

export function initializeCesiumViewer(containerId = 'cesiumContainer') {
  const ionToken = import.meta.env.CESIUM_ION_TOKEN;
  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
  }

  const viewer = new Cesium.Viewer(containerId, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    scene3DOnly: true,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  });

  // Visual atmosphere tuning
  const scene = viewer.scene;
  scene.globe.enableLighting = true;
  scene.globe.depthTestAgainstTerrain = false;
  scene.globe.showGroundAtmosphere = true;
  scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0d14');

  // Initial global view
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 20000000.0),
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-90.0),
      roll: 0.0,
    },
  });

  return viewer;
}
