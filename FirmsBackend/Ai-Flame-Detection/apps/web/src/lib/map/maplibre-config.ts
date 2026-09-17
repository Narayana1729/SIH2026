/**
 * 2D MapLibre GL Basemap Configuration
 * Keyless, watermark-free intelligence styles with dynamic Light/Dark adaptability.
 */

function resolveStyleUrl(isDark: boolean = true): string {
  if (typeof process !== "undefined" && process.env) {
    if (isDark && process.env.NEXT_PUBLIC_MAP_STYLE_URL) {
      return process.env.NEXT_PUBLIC_MAP_STYLE_URL;
    }
    if (!isDark && process.env.NEXT_PUBLIC_MAP_LIGHT_STYLE_URL) {
      return process.env.NEXT_PUBLIC_MAP_LIGHT_STYLE_URL;
    }
    if (process.env.NEXT_PUBLIC_MAPTILER_KEY) {
      const mode = isDark ? "dataviz-dark" : "dataviz-light";
      return `https://api.maptiler.com/maps/${mode}/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`;
    }
  }

  // CARTO Vector Basemaps: 100% Free, Keyless, Open Source, High-DPI Vector Cartography
  return isDark
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
}

export const MAPLIBRE_CONFIG = {
  // Vector Basemaps
  style: resolveStyleUrl(true),
  darkStyle: resolveStyleUrl(true),
  lightStyle: resolveStyleUrl(false),

  // Fallback Raster Basemaps (ESRI Canvas - 100% Keyless)
  fallbackStyle: {
    version: 8 as const,
    name: "ESRI Dark Gray Canvas",
    sources: {
      "esri-dark": {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      },
      "esri-dark-ref": {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "esri-dark-base",
        type: "raster" as const,
        source: "esri-dark",
        minzoom: 0,
        maxzoom: 19,
      },
      {
        id: "esri-dark-labels",
        type: "raster" as const,
        source: "esri-dark-ref",
        minzoom: 0,
        maxzoom: 19,
        paint: {
          "raster-opacity": 0.65,
        },
      },
    ],
  },

  lightFallbackStyle: {
    version: 8 as const,
    name: "ESRI Light Gray Canvas",
    sources: {
      "esri-light": {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      },
      "esri-light-ref": {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "esri-light-base",
        type: "raster" as const,
        source: "esri-light",
        minzoom: 0,
        maxzoom: 19,
      },
      {
        id: "esri-light-labels",
        type: "raster" as const,
        source: "esri-light-ref",
        minzoom: 0,
        maxzoom: 19,
        paint: {
          "raster-opacity": 0.75,
        },
      },
    ],
  },

  // Initial geographic center: Global Overview / Jamnagar Anchor
  initialCenter: [70.0577, 22.4707] as [number, number], // [lng, lat]
  initialZoom: 4.5,
  minZoom: 1.5,
  maxZoom: 18,
};
