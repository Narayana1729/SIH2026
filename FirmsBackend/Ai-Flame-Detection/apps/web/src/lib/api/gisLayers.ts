import { apiFetch } from "./client";

export interface GisGeoJsonFeature {
  type: "Feature";
  id?: string;
  geometry: {
    type: "Point" | "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  properties: Record<string, any>;
}

export interface GisFeatureCollection {
  type: "FeatureCollection";
  features: GisGeoJsonFeature[];
}

export const EMPTY_GIS_COLLECTION: GisFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export async function fetchEmergencyServicesGeoJson(): Promise<GisFeatureCollection> {
  try {
    const data = await apiFetch<GisFeatureCollection>("/api/emergency-services", {
      timeoutMs: 6000,
    });
    if (data && Array.isArray(data.features)) {
      return data;
    }
  } catch (err) {
    console.warn("fetchEmergencyServicesGeoJson fallback:", err);
  }
  return EMPTY_GIS_COLLECTION;
}

export async function fetchHistoricalDisastersGeoJson(): Promise<GisFeatureCollection> {
  try {
    const data = await apiFetch<GisFeatureCollection>("/api/historical-disasters", {
      timeoutMs: 6000,
    });
    if (data && Array.isArray(data.features)) {
      return data;
    }
  } catch (err) {
    console.warn("fetchHistoricalDisastersGeoJson fallback:", err);
  }
  return EMPTY_GIS_COLLECTION;
}

export async function fetchMultimodalBenchmarkGeoJson(): Promise<GisFeatureCollection> {
  try {
    const data = await apiFetch<GisFeatureCollection>("/api/multimodal-benchmark", {
      timeoutMs: 6000,
    });
    if (data && Array.isArray(data.features)) {
      return data;
    }
  } catch (err) {
    console.warn("fetchMultimodalBenchmarkGeoJson fallback:", err);
  }
  return EMPTY_GIS_COLLECTION;
}

export async function fetchIndiaBoundariesGeoJson(): Promise<GisFeatureCollection> {
  try {
    const data = await apiFetch<GisFeatureCollection>("/api/boundaries", {
      timeoutMs: 6000,
    });
    if (data && Array.isArray(data.features)) {
      return data;
    }
  } catch (err) {
    console.warn("fetchIndiaBoundariesGeoJson fallback:", err);
  }
  return EMPTY_GIS_COLLECTION;
}

