/**
 * Cesium 3D Tactical Globe Initialization and Layer Setup.
 * Handles Photorealistic 3D Tiles, Cesium Ion token, terrain elevation, and imagery layers.
 */

import * as Cesium from "cesium";

export interface CesiumCredentials {
  googleApiKey?: string;
  cesiumToken?: string;
}

export function ensureCesiumGlobal() {
  if (typeof window !== "undefined") {
    (window as any).CESIUM_BASE_URL = "/cesium";
    if (!(window as any).Cesium) {
      (window as any).Cesium = Cesium;
    }
  }
}

export const DEFAULT_SRIVISION_ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjJULU9RZnBWX1dpYnBkVHoiLCJqdGkiOiIwMmY5MGVhNi1kNTYyLTRlZTMtYmUwMi01MTJhYWUxMDAyMzkiLCJpZCI6NDkwODA5LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODkyMjAyMDd9.BZBul74JoE5PT7dfO_5zvt1ou6AfMT2M0yt3rzpAIKA";

/**
 * Initializes the Cesium 3D Tactical Viewer with performance governors and visual tuning.
 */
export function initializeCesiumTacticalViewer(
  container: HTMLElement | string,
  credentials?: CesiumCredentials
): Cesium.Viewer {
  ensureCesiumGlobal();

  const ionToken =
    credentials?.cesiumToken ||
    process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ||
    process.env.CESIUM_ION_TOKEN ||
    DEFAULT_SRIVISION_ION_TOKEN;

  if (ionToken) {
    Cesium.Ion.defaultAccessToken = ionToken;
  }

  const viewer = new Cesium.Viewer(container, {
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

  // Load high-resolution Esri World Satellite Imagery by default (just like sriVision)
  Cesium.ArcGisMapServerImageryProvider.fromUrl(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    {
      enablePickFeatures: false,
    }
  )
    .then((imageryProvider) => {
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(imageryProvider);
      viewer.scene.requestRender();
    })
    .catch((err) => {
      console.warn("[Cesium] Esri satellite imagery fallback to OSM:", err);
      try {
        const osmProvider = new Cesium.OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        });
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(osmProvider);
      } catch {}
    });

  // Load Re:Earth 3D global terrain elevation
  Cesium.CesiumTerrainProvider.fromUrl("https://terrain.reearth.land/cesium-mesh/ellipsoid")
    .then((terrainProvider) => {
      viewer.terrainProvider = terrainProvider;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.requestRender();
    })
    .catch(() => {});

  const scene = viewer.scene;
  scene.globe.enableLighting = true;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.atmosphereLightIntensity = 1.8;
  scene.globe.atmosphereRayleighCoefficient = new Cesium.Cartesian3(0.0000055, 0.000013, 0.0000284);
  scene.globe.atmosphereMieCoefficient = new Cesium.Cartesian3(0.000004, 0.000004, 0.000004);
  scene.backgroundColor = Cesium.Color.fromCssColorString("#0a0d14");

  // Initial camera perspective (Centered on India)
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 3600000.0),
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-78.0),
      roll: 0.0,
    },
  });

  return viewer;
}

/**
 * Load Google Photorealistic 3D Tiles if API key or Cesium Ion token is available.
 */
export async function loadPhotorealistic3DTiles(
  viewer: Cesium.Viewer,
  credentials?: CesiumCredentials
): Promise<Cesium.Cesium3DTileset | null> {
  const googleApiKey =
    credentials?.googleApiKey ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  const ionToken =
    credentials?.cesiumToken ||
    process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ||
    process.env.CESIUM_ION_TOKEN ||
    DEFAULT_SRIVISION_ION_TOKEN;

  if (googleApiKey) {
    try {
      Cesium.GoogleMaps.defaultApiKey = googleApiKey;
      const tileset = await Cesium.createGooglePhotorealistic3DTileset({
        onlyUsingWithGoogleGeocoder: true,
      });
      viewer.scene.primitives.add(tileset);
      return tileset;
    } catch (e) {
      console.warn("[Cesium] Direct Google 3D Tiles request failed:", e);
    }
  }

  if (ionToken) {
    try {
      Cesium.Ion.defaultAccessToken = ionToken;
      const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(2275207); // Google Photorealistic 3D Tiles on Ion
      viewer.scene.primitives.add(tileset);
      return tileset;
    } catch (e) {
      console.warn("[Cesium] Ion 3D Tiles asset load fallback failed:", e);
    }
  }

  return null;
}
