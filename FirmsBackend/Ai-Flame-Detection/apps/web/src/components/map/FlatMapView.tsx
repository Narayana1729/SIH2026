"use client";

import React, { useEffect, useRef, useState, useMemo, useImperativeHandle, forwardRef, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAPLIBRE_CONFIG } from "@/lib/map/maplibre-config";
import { ThermalEvent } from "@/types/event";
import { createFireMarkerElement, updateFireMarkerSelection } from "./FireMarkerElement";
import { useEventContext } from "@/context/EventContext";
import { useTheme } from "@/context/ThemeContext";
import { useEventDispersion } from "@/hooks/useEventDispersion";
import { fetchForestsGeoJson, ForestGeoJsonFeatureCollection } from "@/lib/api/forests";
import { DEMO_FORESTS_GEOJSON } from "@/features/forests/mock/demo-forests";
import { useIndustrialAssets } from "@/hooks/useIndustrialAssets";
import {
  IndustrialAssetFeatureCollection,
  filterIndustrialAssetsByLayers,
  EMPTY_INDUSTRIAL_COLLECTION,
} from "@/lib/api/industrial";
import { generateCloudMaskGeoJson } from "@/lib/map/cloudMaskLayer";
import { useGisExtraLayers } from "@/hooks/useGisExtraLayers";
import { GisFeatureCollection, EMPTY_GIS_COLLECTION } from "@/lib/api/gisLayers";
import { AlertTriangle, RefreshCw, Wind, Compass, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Configure MapLibre Web Worker URL explicitly to avoid localhost HTML fallback
if (typeof window !== "undefined" && typeof (maplibregl as any).setWorkerUrl === "function") {
  try {
    (maplibregl as any).setWorkerUrl("/maplibre-gl-worker.mjs");
  } catch (err) {
    console.warn("MapLibre setWorkerUrl fallback:", err);
  }
}

function computeCircleCoordinates(lat: number, lon: number, distanceKm: number): [number, number][] {
  const R = 6371;
  const pts: [number, number][] = [];
  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;
  const angDist = distanceKm / R;
  for (let angle = 0; angle <= 360; angle += 10) {
    const radBearing = (angle * Math.PI) / 180;
    const lat2 = Math.asin(
      Math.sin(radLat) * Math.cos(angDist) +
        Math.cos(radLat) * Math.sin(angDist) * Math.cos(radBearing)
    );
    const lon2 =
      radLon +
      Math.atan2(
        Math.sin(radBearing) * Math.sin(angDist) * Math.cos(radLat),
        Math.cos(angDist) - Math.sin(radLat) * Math.sin(lat2)
      );
    pts.push([
      Number(((lon2 * 180) / Math.PI).toFixed(6)),
      Number(((lat2 * 180) / Math.PI).toFixed(6)),
    ]);
  }
  return pts;
}

function computeForestThreatRings(lat: number, lon: number) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [computeCircleCoordinates(lat, lon, 10.0)] },
        properties: {
          level: "AWARENESS",
          label: "10 km Awareness Buffer",
          color: "#3b82f6",
        },
      },
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [computeCircleCoordinates(lat, lon, 5.0)] },
        properties: {
          level: "WARNING",
          label: "5 km Warning Buffer",
          color: "#f59e0b",
        },
      },
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [computeCircleCoordinates(lat, lon, 2.0)] },
        properties: {
          level: "CRITICAL",
          label: "2 km Critical Buffer",
          color: "#ef4444",
        },
      },
    ],
  };
}

/**
 * Generate 10 km Awareness & 5 km Warning monitoring circles for all monitored forests.
 */
function computeForestsMonitoringRings(forestsData: ForestGeoJsonFeatureCollection) {
  const features: any[] = [];
  if (!forestsData || !Array.isArray(forestsData.features)) {
    return { type: "FeatureCollection", features: [] };
  }

  for (const f of forestsData.features) {
    const p = f.properties || ({} as any);
    const centroidLat = p.centroid?.latitude ?? (f.geometry.type === "Polygon" ? f.geometry.coordinates[0]?.[0]?.[1] : 0);
    const centroidLon = p.centroid?.longitude ?? (f.geometry.type === "Polygon" ? f.geometry.coordinates[0]?.[0]?.[0] : 0);

    if (!centroidLat || !centroidLon) continue;

    // 10 km Awareness Circle
    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [computeCircleCoordinates(centroidLat, centroidLon, 10.0)],
      },
      properties: {
        forest_id: p.forest_id,
        forest_name: p.name || p.name_en || "Forest Zone",
        level: "AWARENESS",
        radius_km: 10.0,
        color: "#3b82f6",
      },
    });

    // 5 km Warning Circle
    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [computeCircleCoordinates(centroidLat, centroidLon, 5.0)],
      },
      properties: {
        forest_id: p.forest_id,
        forest_name: p.name || p.name_en || "Forest Zone",
        level: "WARNING",
        radius_km: 5.0,
        color: "#f59e0b",
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export interface FlatMapViewProps {
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  events?: ThermalEvent[];
  selectedEvent?: ThermalEvent | null;
  isVisible?: boolean;
  onSelectEvent?: (event: ThermalEvent) => void;
  onCameraChange?: (lat: number, lng: number, zoom: number) => void;
  className?: string;
}

export interface FlatMapViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  resize: () => void;
  getMapInstance: () => maplibregl.Map | null;
}

export const FlatMapView = forwardRef<FlatMapViewHandle, FlatMapViewProps>(
  function FlatMapView(
    {
      initialLat = MAPLIBRE_CONFIG.initialCenter[1],
      initialLng = MAPLIBRE_CONFIG.initialCenter[0],
      initialZoom = MAPLIBRE_CONFIG.initialZoom,
      events = [],
      selectedEvent,
      isVisible = true,
      onSelectEvent,
      onCameraChange,
      className,
    }: FlatMapViewProps,
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<maplibregl.Map | null>(null);
    const markerMapRef = useRef<
      Map<
        string,
        {
          marker: maplibregl.Marker;
          element: HTMLElement;
          event: ThermalEvent;
          isSelected: boolean;
        }
      >
    >(new Map());
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [initCount, setInitCount] = useState(0);
    const fallbackAttemptedRef = useRef(false);

    // Forest State & Active Layers
    const { activeLayers } = useEventContext();
    const { resolvedTheme } = useTheme();
    const isForestLayerActive = activeLayers?.["indian-forest-reserves"] ?? true;
    const isCloudMaskActive = activeLayers?.["sensor-cloud-mask"] ?? true;
    const isEmergencyLayerActive = activeLayers?.["india-emergency-services"] ?? true;
    const isDisasterLayerActive = activeLayers?.["historical-disasters"] ?? true;
    const isBenchmarkLayerActive = activeLayers?.["multimodal-benchmark"] ?? true;
    const isBoundariesLayerActive = activeLayers?.["india-boundaries"] ?? true;
    const isHazmatLayerActive = activeLayers?.["cameo-niosh-hazmat"] ?? true;

    const forestGeoJsonRef = useRef<ForestGeoJsonFeatureCollection>(DEMO_FORESTS_GEOJSON);
    const [forestData, setForestData] = useState<ForestGeoJsonFeatureCollection>(DEMO_FORESTS_GEOJSON);
    const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
    const cloudPopupRef = useRef<maplibregl.Popup | null>(null);
    const emergencyPopupRef = useRef<maplibregl.Popup | null>(null);
    const disasterPopupRef = useRef<maplibregl.Popup | null>(null);
    const benchmarkPopupRef = useRef<maplibregl.Popup | null>(null);

    // Extra GIS Layers (Emergency Services, Historical Disasters, Benchmark Nodes, State Boundaries)
    const { emergencyData, disastersData, benchmarkData, boundariesData } = useGisExtraLayers();

    // Industrial Infrastructure Layer State & Dynamic GIS Layer Selection
    const { data: industrialData } = useIndustrialAssets();
    const filteredIndustrialData = useMemo(() => {
      return filterIndustrialAssetsByLayers(industrialData, activeLayers);
    }, [industrialData, activeLayers]);
    const industrialGeoJsonRef = useRef<IndustrialAssetFeatureCollection>(filteredIndustrialData);
    industrialGeoJsonRef.current = filteredIndustrialData;
    const industrialPopupRef = useRef<maplibregl.Popup | null>(null);

    // Atmospheric Dispersion & Plume Hazard State
    const { dispersion, geojson: dispersionGeoJson } = useEventDispersion(selectedEvent);

    const currentThemeRef = useRef(resolvedTheme);

    const initialCameraRef = useRef({
      lat: initialLat,
      lng: initialLng,
      zoom: initialZoom,
    });

    const onCameraChangeRef = useRef(onCameraChange);
    onCameraChangeRef.current = onCameraChange;

    const onSelectEventRef = useRef(onSelectEvent);
    onSelectEventRef.current = onSelectEvent;

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.zoomIn({ duration: 300 });
          }
        },
        zoomOut: () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.zoomOut({ duration: 300 });
          }
        },
        resetView: () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo({
              center: [initialCameraRef.current.lng, initialCameraRef.current.lat],
              zoom: initialCameraRef.current.zoom,
              duration: 800,
            });
          }
        },
        resize: () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.resize();
          }
        },
        getMapInstance: () => mapInstanceRef.current,
      }),
      []
    );

    /**
     * Idempotently reconciles Forest Polygons and Protection/Monitoring Radius Layers on MapLibre.
     */
    const reconcileForestLayers = useCallback((
      map: maplibregl.Map,
      data: ForestGeoJsonFeatureCollection,
      active: boolean
    ) => {
      const forestSourceId = "forest-intelligence-source";
      const forestFillLayerId = "forest-intelligence-fill";
      const forestLineLayerId = "forest-intelligence-line";
      const ringsSourceId = "forest-global-monitoring-rings-source";
      const ringsFillLayerId = "forest-global-monitoring-rings-fill";
      const ringsLineLayerId = "forest-global-monitoring-rings-line";

      if (!active) {
        if (map.getLayer(forestFillLayerId)) map.removeLayer(forestFillLayerId);
        if (map.getLayer(forestLineLayerId)) map.removeLayer(forestLineLayerId);
        if (map.getLayer(ringsFillLayerId)) map.removeLayer(ringsFillLayerId);
        if (map.getLayer(ringsLineLayerId)) map.removeLayer(ringsLineLayerId);
        if (map.getSource(forestSourceId)) map.removeSource(forestSourceId);
        if (map.getSource(ringsSourceId)) map.removeSource(ringsSourceId);
        return;
      }

      const ringsData = computeForestsMonitoringRings(data);

      // 1. Forest Protection/Monitoring Rings Source & Layers
      if (map.getSource(ringsSourceId)) {
        (map.getSource(ringsSourceId) as maplibregl.GeoJSONSource).setData(ringsData as any);
      } else {
        map.addSource(ringsSourceId, {
          type: "geojson",
          data: ringsData as any,
        });

        if (!map.getLayer(ringsFillLayerId)) {
          map.addLayer(
            {
              id: ringsFillLayerId,
              type: "fill",
              source: ringsSourceId,
              paint: {
                "fill-color": [
                  "match",
                  ["get", "level"],
                  "WARNING",
                  "#f59e0b",
                  "#3b82f6",
                ],
                "fill-opacity": [
                  "match",
                  ["get", "level"],
                  "WARNING",
                  0.04,
                  0.02,
                ],
              },
            },
            map.getLayer("selected-incident-plume-fill") ? "selected-incident-plume-fill" : undefined
          );
        }

        if (!map.getLayer(ringsLineLayerId)) {
          map.addLayer({
            id: ringsLineLayerId,
            type: "line",
            source: ringsSourceId,
            paint: {
              "line-color": [
                "match",
                ["get", "level"],
                "WARNING",
                "#f59e0b",
                "#3b82f6",
              ],
              "line-width": [
                "match",
                ["get", "level"],
                "WARNING",
                1.4,
                1.0,
              ],
              "line-dasharray": [3, 2],
              "line-opacity": 0.75,
            },
          });
        }
      }

      // 2. Forest Polygons Source & Layers
      if (map.getSource(forestSourceId)) {
        (map.getSource(forestSourceId) as maplibregl.GeoJSONSource).setData(data as any);
      } else {
        map.addSource(forestSourceId, {
          type: "geojson",
          data: data as any,
        });

        if (!map.getLayer(forestFillLayerId)) {
          map.addLayer(
            {
              id: forestFillLayerId,
              type: "fill",
              source: forestSourceId,
              paint: {
                "fill-color": [
                  "match",
                  ["get", "threat_level"],
                  "ACTIVE_FIRE",
                  "#ef4444",
                  "CRITICAL",
                  "#dc2626",
                  "WARNING",
                  "#f59e0b",
                  "AWARENESS",
                  "#3b82f6",
                  "#22c55e", // Default SAFE / Monitored Forest Green
                ],
                "fill-opacity": [
                  "match",
                  ["get", "threat_level"],
                  "ACTIVE_FIRE",
                  0.35,
                  "CRITICAL",
                  0.28,
                  "WARNING",
                  0.24,
                  "AWARENESS",
                  0.20,
                  0.18,
                ],
              },
            },
            map.getLayer("selected-incident-plume-fill") ? "selected-incident-plume-fill" : undefined
          );
        }

        if (!map.getLayer(forestLineLayerId)) {
          map.addLayer({
            id: forestLineLayerId,
            type: "line",
            source: forestSourceId,
            paint: {
              "line-color": [
                "match",
                ["get", "threat_level"],
                "ACTIVE_FIRE",
                "#b91c1c",
                "CRITICAL",
                "#991b1b",
                "WARNING",
                "#d97706",
                "AWARENESS",
                "#2563eb",
                "#16a34a",
              ],
              "line-width": 1.4,
              "line-opacity": 0.85,
            },
          });
        }

        // Add interactive hover & cursor styling for forests
        map.on("mouseenter", forestFillLayerId, (e) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = e.features?.[0];
          if (!feature) return;

          const p = feature.properties as any;
          const name = p.name || p.name_en || "Monitored Forest Reserve";
          const area = p.area_km2 ? `${Math.round(p.area_km2).toLocaleString()} km²` : "N/A";
          const forestType = p.forest_type?.replace(/_/g, " ") || "Protected Woodland";
          const threat = p.threat_level || "SAFE";

          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove();
          }

          hoverPopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
            className: "forest-tooltip-popup",
          })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="background:#0f172a; border:1px solid #334155; border-radius:6px; padding:8px 10px; color:#f8fafc; font-family:monospace; font-size:11px; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                  <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${threat === 'ACTIVE_FIRE' ? '#ef4444' : threat === 'CRITICAL' ? '#dc2626' : threat === 'WARNING' ? '#f59e0b' : '#22c55e'};"></span>
                  <strong style="font-size:12px; color:#ffffff;">${name}</strong>
                </div>
                <div style="color:#94a3b8; font-size:10px;">${forestType} • ${p.country_code || 'GLOBAL'}</div>
                <div style="margin-top:4px; display:flex; justify-content:space-between; gap:12px;">
                  <span style="color:#cbd5e1;">Area:</span>
                  <span style="color:#38bdf8; font-weight:600;">${area}</span>
                </div>
                <div style="display:flex; justify-content:space-between; gap:12px;">
                  <span style="color:#cbd5e1;">Status:</span>
                  <span style="color:${threat === 'ACTIVE_FIRE' ? '#f87171' : threat === 'CRITICAL' ? '#f87171' : threat === 'WARNING' ? '#fbbf24' : '#4ade80'}; font-weight:bold;">${threat}</span>
                </div>
              </div>
            `)
            .addTo(map);
        });

        map.on("mouseleave", forestFillLayerId, () => {
          map.getCanvas().style.cursor = "";
          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove();
            hoverPopupRef.current = null;
          }
        });
      }
    }, []);

    /**
     * Idempotently reconciles Industrial Infrastructure MapLibre GeoJSON Source and Circle Layers.
     * Uses native WebGL circle rendering to guarantee zero coordinate drift during zoom and pan.
     */
    const reconcileIndustrialLayers = useCallback((
      map: maplibregl.Map,
      data: IndustrialAssetFeatureCollection,
      active: boolean = true
    ) => {
      const sourceId = "industrial-assets-source";
      const glowLayerId = "industrial-assets-glow";
      const circleLayerId = "industrial-assets-circle";

      const hasFeatures = active && Boolean(data && Array.isArray(data.features) && data.features.length > 0);

      if (!hasFeatures) {
        if (industrialPopupRef.current) {
          industrialPopupRef.current.remove();
          industrialPopupRef.current = null;
        }
        if (map.getSource(sourceId)) {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(EMPTY_INDUSTRIAL_COLLECTION as any);
        }
        if (map.getLayer(glowLayerId)) {
          map.setLayoutProperty(glowLayerId, "visibility", "none");
        }
        if (map.getLayer(circleLayerId)) {
          map.setLayoutProperty(circleLayerId, "visibility", "none");
        }
        return;
      }

      const currentData = (hasFeatures ? data : EMPTY_INDUSTRIAL_COLLECTION) as any;
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(currentData);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: currentData,
        });
      }

      // 1. Ambient tactical halo glow
      if (!map.getLayer(glowLayerId)) {
        map.addLayer({
          id: glowLayerId,
          type: "circle",
          source: sourceId,
          layout: {
            visibility: hasFeatures ? "visible" : "none",
          },
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 5,
              6, 8,
              10, 13,
              14, 18,
            ],
            "circle-color": [
              "match",
              ["get", "industry"],
              "power", "#eab308",
              "oil_gas", "#f97316",
              "metallurgy", "#a855f7",
              "chemical", "#06b6d4",
              "#10b981",
            ],
            "circle-opacity": 0.35,
            "circle-blur": 0.5,
          },
        });
      } else {
        map.setLayoutProperty(glowLayerId, "visibility", hasFeatures ? "visible" : "none");
      }

      // 2. Crisp tactical circle layer
      if (!map.getLayer(circleLayerId)) {
        map.addLayer({
          id: circleLayerId,
          type: "circle",
          source: sourceId,
          layout: {
            visibility: hasFeatures ? "visible" : "none",
          },
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 3.5,
              6, 5.5,
              10, 8.5,
              14, 12,
            ],
            "circle-color": [
              "match",
              ["get", "industry"],
              "power", "#eab308",
              "oil_gas", "#f97316",
              "metallurgy", "#a855f7",
              "chemical", "#06b6d4",
              "#10b981",
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.4,
            "circle-opacity": 0.95,
          },
        });

          // Interactive hover & tooltip popup
          map.on("mouseenter", circleLayerId, (e) => {
            map.getCanvas().style.cursor = "pointer";
            const feat = e.features?.[0];
            if (!feat) return;

            const p = (feat.properties || {}) as Record<string, any>;
            const coords = (feat.geometry as any).coordinates.slice();
            const ind = String(p.industry || "industrial").toUpperCase();
            const status = String(p.status || "operating").toUpperCase();
            const capStr = p.capacity
              ? `${p.capacity} ${p.capacity_unit || "MW"}`
              : null;
            const fuelStr = p.primary_fuel ? `Fuel: ${p.primary_fuel}` : null;
            const ownerStr = p.owner ? `Owner: ${p.owner}` : null;
            const locStr = [p.city, p.state, p.country || "India"].filter(Boolean).join(", ");
            const coordStr = `${Number(coords[1]).toFixed(4)}°N, ${Number(coords[0]).toFixed(4)}°E`;

            const sectorColor =
              p.industry === "power"
                ? "#eab308"
                : p.industry === "oil_gas"
                ? "#f97316"
                : p.industry === "metallurgy"
                ? "#a855f7"
                : p.industry === "chemical"
                ? "#06b6d4"
                : "#10b981";

            const popupHtml = `
              <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 7px 10px; min-width: 200px; max-width: 260px; color: #f2f5f7; font-size: 11px; line-height: 1.4; background: rgba(13, 17, 23, 0.95); border: 1px solid #252c35; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); backdrop-filter: blur(8px);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
                  <strong style="font-size: 12px; color: #f2f5f7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${p.name || "Industrial Facility"}
                  </strong>
                </div>
                <div style="display: flex; gap: 4px; margin-bottom: 5px; font-size: 9px;">
                  <span style="background: ${sectorColor}26; color: ${sectorColor}; padding: 1px 5px; border-radius: 3px; border: 1px solid ${sectorColor}55; font-weight: 600;">
                    ${ind}
                  </span>
                  <span style="background: rgba(57, 255, 136, 0.15); color: #39ff88; padding: 1px 5px; border-radius: 3px; border: 1px solid rgba(57, 255, 136, 0.3); font-weight: 600;">
                    ${status}
                  </span>
                </div>
                ${locStr ? `<div style="color: #b5bec8; font-size: 10px; margin-bottom: 2px;">📍 ${locStr}</div>` : ""}
                ${capStr ? `<div style="color: #ffbf24; font-size: 10px; font-weight: 600; margin-bottom: 1px;">⚡ ${capStr}</div>` : ""}
                ${fuelStr ? `<div style="color: #737e89; font-size: 9px; margin-bottom: 1px;">${fuelStr}</div>` : ""}
                ${ownerStr ? `<div style="color: #4b545e; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px;">${ownerStr}</div>` : ""}
                <div style="border-top: 1px solid #252c35; padding-top: 3px; margin-top: 3px; display: flex; justify-content: space-between; font-size: 9px; color: #737e89;">
                  <span>COORDS</span>
                  <span style="color: #00d9ff;">${coordStr}</span>
                </div>
              </div>
            `;

            if (industrialPopupRef.current) {
              industrialPopupRef.current.remove();
            }

            industrialPopupRef.current = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 10,
              className: "industrial-tooltip-popup",
            })
              .setLngLat(coords as [number, number])
              .setHTML(popupHtml)
              .addTo(map);
          });

          map.on("mouseleave", circleLayerId, () => {
            map.getCanvas().style.cursor = "";
            if (industrialPopupRef.current) {
              industrialPopupRef.current.remove();
              industrialPopupRef.current = null;
            }
          });
        } else {
          map.setLayoutProperty(circleLayerId, "visibility", hasFeatures ? "visible" : "none");
        }
    }, []);

    /**
     * Reconciles Emergency Services Layer (Fire Brigades, Apex Burn ICUs, Hospitals, NDRF).
     */
    const reconcileEmergencyServicesLayers = useCallback((map: maplibregl.Map, data: GisFeatureCollection, isVisible: boolean) => {
      const sourceId = "emergency-services-source";
      const glowLayerId = "emergency-services-glow";
      const pointLayerId = "emergency-services-point";

      if (!map || !map.isStyleLoaded()) return;

      const hasFeatures = isVisible && data && Array.isArray(data.features) && data.features.length > 0;
      const currentData = (hasFeatures ? data : EMPTY_GIS_COLLECTION) as any;

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(currentData);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: currentData,
        });
      }

      if (!map.getLayer(glowLayerId)) {
        map.addLayer({
          id: glowLayerId,
          type: "circle",
          source: sourceId,
          layout: { visibility: hasFeatures ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 6, 8, 11, 14, 18],
            "circle-color": [
              "match",
              ["get", "facility_type"],
              "hospital", "#06b6d4",
              "#0284c7"
            ],
            "circle-opacity": 0.35,
            "circle-blur": 0.6,
          },
        });
      } else {
        map.setLayoutProperty(glowLayerId, "visibility", hasFeatures ? "visible" : "none");
      }

      if (!map.getLayer(pointLayerId)) {
        map.addLayer({
          id: pointLayerId,
          type: "circle",
          source: sourceId,
          layout: { visibility: hasFeatures ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4.5, 8, 7.5, 14, 11],
            "circle-color": [
              "match",
              ["get", "facility_type"],
              "hospital", "#06b6d4",
              "#0284c7"
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.8,
            "circle-opacity": 0.95,
          },
        });

        map.on("mouseenter", pointLayerId, (e) => {
          map.getCanvas().style.cursor = "pointer";
          const feat = e.features?.[0];
          if (!feat) return;
          const p = feat.properties as any;
          const coords = (feat.geometry as any).coordinates.slice();
          const isHosp = p.facility_type === "hospital";

          const popupHtml = `
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 8px 11px; min-width: 220px; max-width: 280px; color: #f2f5f7; font-size: 11px; background: rgba(10, 18, 30, 0.96); border: 1px solid ${isHosp ? "#06b6d4" : "#0284c7"}; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.7);">
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 3px;">
                <span style="font-size: 13px;">${isHosp ? "🏥" : "🚒"}</span>
                <strong style="font-size: 11.5px; color: #f8fafc;">${p.name || "Emergency Facility"}</strong>
              </div>
              <div style="display: inline-block; font-size: 9px; font-weight: 700; color: ${isHosp ? "#06b6d4" : "#38bdf8"}; background: ${isHosp ? "#06b6d422" : "#0284c722"}; padding: 1px 6px; border-radius: 3px; margin-bottom: 5px; border: 1px solid ${isHosp ? "#06b6d455" : "#0284c755"};">
                ${isHosp ? "APEX BURN & TRAUMA ICU" : "DISTRICT FIRE COMMAND & HAZMAT"}
              </div>
              ${p.phone ? `<div style="color: #38bdf8; font-weight: 600; font-size: 10px; margin-bottom: 2px;">📞 Hotline: ${p.phone}</div>` : ""}
              ${p.cluster_name ? `<div style="color: #94a3b8; font-size: 9.5px; margin-bottom: 2px;">📍 Coverage: ${p.cluster_name}</div>` : ""}
              ${p.ndrf_battalion ? `<div style="color: #cbd5e1; font-size: 9px; margin-bottom: 2px;">🛡️ NDRF: ${p.ndrf_battalion}</div>` : ""}
              ${p.industrial_brigade ? `<div style="color: #cbd5e1; font-size: 9px; margin-bottom: 2px;">⚡ Brigade: ${p.industrial_brigade}</div>` : ""}
            </div>
          `;

          if (emergencyPopupRef.current) emergencyPopupRef.current.remove();
          emergencyPopupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
            .setLngLat(coords as [number, number])
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseleave", pointLayerId, () => {
          map.getCanvas().style.cursor = "";
          if (emergencyPopupRef.current) {
            emergencyPopupRef.current.remove();
            emergencyPopupRef.current = null;
          }
        });
      } else {
        map.setLayoutProperty(pointLayerId, "visibility", hasFeatures ? "visible" : "none");
      }
    }, []);

    /**
     * Reconciles Historical Industrial Disasters Benchmark Layer.
     */
    const reconcileHistoricalDisastersLayers = useCallback((map: maplibregl.Map, data: GisFeatureCollection, isVisible: boolean) => {
      const sourceId = "historical-disasters-source";
      const pulseLayerId = "historical-disasters-pulse";
      const pointLayerId = "historical-disasters-point";

      if (!map || !map.isStyleLoaded()) return;

      const hasFeatures = isVisible && data && Array.isArray(data.features) && data.features.length > 0;
      const currentData = (hasFeatures ? data : EMPTY_GIS_COLLECTION) as any;

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(currentData);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: currentData,
        });
      }

      if (!map.getLayer(pulseLayerId)) {
        map.addLayer({
          id: pulseLayerId,
          type: "circle",
          source: sourceId,
          layout: { visibility: hasFeatures ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 9, 8, 15, 14, 22],
            "circle-color": "#f43f5e",
            "circle-opacity": 0.28,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#f43f5e",
          },
        });
      } else {
        map.setLayoutProperty(pulseLayerId, "visibility", hasFeatures ? "visible" : "none");
      }

      if (!map.getLayer(pointLayerId)) {
        map.addLayer({
          id: pointLayerId,
          type: "circle",
          source: sourceId,
          layout: { visibility: hasFeatures ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 8, 8, 14, 12],
            "circle-color": "#f43f5e",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.95,
          },
        });

        map.on("mouseenter", pointLayerId, (e) => {
          map.getCanvas().style.cursor = "pointer";
          const feat = e.features?.[0];
          if (!feat) return;
          const p = feat.properties as any;
          const coords = (feat.geometry as any).coordinates.slice();

          const popupHtml = `
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 8px 11px; min-width: 230px; max-width: 290px; color: #f2f5f7; font-size: 11px; background: rgba(20, 10, 15, 0.96); border: 1px solid #f43f5e; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.75);">
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 3px;">
                <span style="font-size: 13px;">⚠️</span>
                <strong style="font-size: 11.5px; color: #f8fafc;">${p.event_name || "Historical Disaster"}</strong>
              </div>
              <div style="display: inline-block; font-size: 9px; font-weight: 700; color: #fb7185; background: #f43f5e22; padding: 1px 6px; border-radius: 3px; margin-bottom: 5px; border: 1px solid #f43f5e55;">
                ${p.severity || "DISASTER BENCHMARK"}
              </div>
              ${p.facility_name ? `<div style="color: #cbd5e1; font-size: 10px; margin-bottom: 2px;">🏢 ${p.facility_name}</div>` : ""}
              ${p.incident_date ? `<div style="color: #fda4af; font-size: 9.5px; margin-bottom: 3px;">📅 Date: ${p.incident_date}</div>` : ""}
              ${p.description ? `<div style="color: #94a3b8; font-size: 9px; line-height: 1.35; border-top: 1px solid #33141e; padding-top: 3px;">${p.description}</div>` : ""}
            </div>
          `;

          if (disasterPopupRef.current) disasterPopupRef.current.remove();
          disasterPopupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
            .setLngLat(coords as [number, number])
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseleave", pointLayerId, () => {
          map.getCanvas().style.cursor = "";
          if (disasterPopupRef.current) {
            disasterPopupRef.current.remove();
            disasterPopupRef.current = null;
          }
        });
      } else {
        map.setLayoutProperty(pointLayerId, "visibility", hasFeatures ? "visible" : "none");
      }
    }, []);

    /**
     * Reconciles Multi-Modal AI Ground-Truth Validation Benchmark Nodes Layer.
     */
    const reconcileMultimodalBenchmarkLayers = useCallback((map: maplibregl.Map, data: GisFeatureCollection, isVisible: boolean) => {
      const sourceId = "multimodal-benchmark-source";
      const glowLayerId = "multimodal-benchmark-glow";
      const pointLayerId = "multimodal-benchmark-point";

      if (!map || !map.isStyleLoaded()) return;

      const hasFeatures = isVisible && data && Array.isArray(data.features) && data.features.length > 0;
      const currentData = (hasFeatures ? data : EMPTY_GIS_COLLECTION) as any;

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(currentData);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: currentData,
        });
      }

      if (!map.getLayer(glowLayerId)) {
        map.addLayer({
          id: glowLayerId,
          type: "circle",
          source: sourceId,
          layout: { visibility: hasFeatures ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 8, 8, 14, 14, 20],
            "circle-color": "#a855f7",
            "circle-opacity": 0.35,
            "circle-blur": 0.6,
          },
        });
      } else {
        map.setLayoutProperty(glowLayerId, "visibility", hasFeatures ? "visible" : "none");
      }

      if (!map.getLayer(pointLayerId)) {
        map.addLayer({
          id: pointLayerId,
          type: "circle",
          source: sourceId,
          layout: { visibility: hasFeatures ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4.5, 8, 7, 14, 10],
            "circle-color": "#c084fc",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.8,
            "circle-opacity": 0.95,
          },
        });

        map.on("mouseenter", pointLayerId, (e) => {
          map.getCanvas().style.cursor = "pointer";
          const feat = e.features?.[0];
          if (!feat) return;
          const p = feat.properties as any;
          const coords = (feat.geometry as any).coordinates.slice();

          const popupHtml = `
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 8px 11px; min-width: 220px; max-width: 280px; color: #f2f5f7; font-size: 11px; background: rgba(18, 10, 28, 0.96); border: 1px solid #a855f7; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.7);">
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 3px;">
                <span style="font-size: 13px;">🧠</span>
                <strong style="font-size: 11.5px; color: #f8fafc;">${p.name || "AI Ground-Truth Node"}</strong>
              </div>
              <div style="display: inline-block; font-size: 9px; font-weight: 700; color: #c084fc; background: #a855f722; padding: 1px 6px; border-radius: 3px; margin-bottom: 5px; border: 1px solid #a855f755;">
                ${p.split || "TIER A VALIDATION NODE"}
              </div>
              <div style="color: #cbd5e1; font-size: 10px; margin-bottom: 2px;">⚡ Features: <span style="color: #a855f7; font-weight: 600;">${p.features_count || 26} Extracted Vectors</span></div>
              ${p.f1_score ? `<div style="color: #34d399; font-size: 10px; font-weight: 600; margin-bottom: 2px;">🎯 F1 Accuracy: ${(Number(p.f1_score) * 100).toFixed(1)}%</div>` : ""}
              <div style="border-top: 1px solid #2e1065; padding-top: 3px; margin-top: 3px; font-size: 9px; color: #94a3b8;">
                SIH26162 Ground-Truth Engine
              </div>
            </div>
          `;

          if (benchmarkPopupRef.current) benchmarkPopupRef.current.remove();
          benchmarkPopupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
            .setLngLat(coords as [number, number])
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseleave", pointLayerId, () => {
          map.getCanvas().style.cursor = "";
          if (benchmarkPopupRef.current) {
            benchmarkPopupRef.current.remove();
            benchmarkPopupRef.current = null;
          }
        });
      } else {
        map.setLayoutProperty(pointLayerId, "visibility", hasFeatures ? "visible" : "none");
      }
    }, []);

    /**
     * Reconciles India State & District Administrative Boundaries Layer.
     */
    const reconcileIndiaBoundariesLayers = useCallback((map: maplibregl.Map, data: GisFeatureCollection, isVisible: boolean) => {
      const sourceId = "india-boundaries-source";
      const lineLayerId = "india-boundaries-line";

      if (!map || !map.isStyleLoaded()) return;

      const hasFeatures = isVisible && data && Array.isArray(data.features) && data.features.length > 0;
      const currentData = (hasFeatures ? data : EMPTY_GIS_COLLECTION) as any;

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(currentData);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: currentData,
        });
      }

      if (!map.getLayer(lineLayerId)) {
        map.addLayer({
          id: lineLayerId,
          type: "line",
          source: sourceId,
          layout: { visibility: hasFeatures ? "visible" : "none" },
          paint: {
            "line-color": "#38bdf8",
            "line-width": 1.4,
            "line-dasharray": [4, 4],
            "line-opacity": 0.55,
          },
        });
      } else {
        map.setLayoutProperty(lineLayerId, "visibility", hasFeatures ? "visible" : "none");
      }
    }, []);

    /**
     * Reconciles CAMEO-NIOSH Chemical Hazard & ERG Isolation Zones Layer.
     */
    const reconcileCameoHazmatLayers = useCallback((map: maplibregl.Map, selectedEvt: ThermalEvent | null | undefined, isVisible: boolean) => {
      const sourceId = "cameo-hazmat-source";
      const isolationLayerId = "cameo-hazmat-isolation";
      const lineLayerId = "cameo-hazmat-line";

      if (!map || !map.isStyleLoaded()) return;

      const hasEvent = isVisible && Boolean(selectedEvt && selectedEvt.latitude && selectedEvt.longitude);

      if (!hasEvent || !selectedEvt) {
        if (map.getSource(sourceId)) {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(EMPTY_GIS_COLLECTION as any);
        }
        if (map.getLayer(isolationLayerId)) map.setLayoutProperty(isolationLayerId, "visibility", "none");
        if (map.getLayer(lineLayerId)) map.setLayoutProperty(lineLayerId, "visibility", "none");
        return;
      }

      const lat = selectedEvt.latitude;
      const lon = selectedEvt.longitude;
      const radiusKm = ((selectedEvt as any).evacuation_radius_km && (selectedEvt as any).evacuation_radius_km > 0) ? (selectedEvt as any).evacuation_radius_km : 2.5;

      const circleCoords = computeCircleCoordinates(lat, lon, radiusKm);
      const hazmatGeoJson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "cameo-hazmat-isolation-zone",
            geometry: {
              type: "Polygon",
              coordinates: [circleCoords],
            },
            properties: {
              title: "CAMEO-NIOSH Chemical Hazard Isolation Boundary",
              unNumber: (selectedEvt as any).un_number || "UN 1993",
              radiusKm: radiusKm,
              toxicScore: (selectedEvt as any).toxicity_score || "IDLH Critical",
              chemicals: (selectedEvt as any).chemicals?.join(", ") || "Industrial VOCs / Hydrocarbons",
            },
          },
        ],
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(hazmatGeoJson as any);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: hazmatGeoJson as any,
        });
      }

      if (!map.getLayer(isolationLayerId)) {
        map.addLayer({
          id: isolationLayerId,
          type: "fill",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: {
            "fill-color": "#ef4444",
            "fill-opacity": 0.12,
          },
        });
      } else {
        map.setLayoutProperty(isolationLayerId, "visibility", "visible");
      }

      if (!map.getLayer(lineLayerId)) {
        map.addLayer({
          id: lineLayerId,
          type: "line",
          source: sourceId,
          layout: { visibility: "visible" },
          paint: {
            "line-color": "#ef4444",
            "line-width": 1.6,
            "line-dasharray": [4, 2],
            "line-opacity": 0.8,
          },
        });
      } else {
        map.setLayoutProperty(lineLayerId, "visibility", "visible");
      }
    }, []);

    /**
     * Idempotently reconciles Sensor Visibility & Cloud Opacity Mask Layer.
     * Visualizes meteorological blind zones to avoid false assumptions of zero-fire.
     */
    const reconcileCloudMaskLayers = useCallback((map: maplibregl.Map, isVisible: boolean) => {
      const sourceId = "sensor-cloud-mask-source";
      const fillLayerId = "sensor-cloud-mask-fill";
      const lineLayerId = "sensor-cloud-mask-line";

      if (!map || !map.isStyleLoaded()) return;

      const visibility = isVisible ? "visible" : "none";

      if (map.getSource(sourceId)) {
        if (map.getLayer(fillLayerId)) map.setLayoutProperty(fillLayerId, "visibility", visibility);
        if (map.getLayer(lineLayerId)) map.setLayoutProperty(lineLayerId, "visibility", visibility);
      } else if (isVisible) {
        const cloudData = generateCloudMaskGeoJson();
        map.addSource(sourceId, {
          type: "geojson",
          data: cloudData as any,
        });

        if (!map.getLayer(fillLayerId)) {
          map.addLayer(
            {
              id: fillLayerId,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": "#475569",
                "fill-opacity": 0.18,
              },
            },
            map.getLayer("selected-incident-plume-fill") ? "selected-incident-plume-fill" : undefined
          );
        }

        if (!map.getLayer(lineLayerId)) {
          map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": "#94a3b8",
              "line-width": 1.2,
              "line-dasharray": [3, 2],
              "line-opacity": 0.45,
            },
          });

          map.on("mouseenter", fillLayerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mousemove", fillLayerId, (e) => {
            if (!e.features || !e.features[0]) return;
            const p = e.features[0].properties as any;
            const coords = e.lngLat;

            const popupHtml = `
              <div style="font-family: ui-monospace, monospace; padding: 7px 10px; max-width: 250px; color: #f8fafc; font-size: 11px; background: rgba(15, 23, 42, 0.95); border: 1px solid #475569; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
                <div style="font-weight: 600; color: #94a3b8; font-size: 9.5px; text-transform: uppercase; margin-bottom: 2px;">
                  SENSOR BLIND ZONE
                </div>
                <div style="font-weight: bold; font-size: 11px; color: #f8fafc; margin-bottom: 4px;">
                  ${p.label || "Cloud Mask Area"}
                </div>
                <div style="font-size: 9px; color: #ef4444; font-weight: 600; margin-bottom: 3px;">
                  STATUS: ${p.thermalStatus} (${Math.round((p.cloudOpacity || 0.8) * 100)}% OPACITY)
                </div>
                <div style="font-size: 9px; color: #cbd5e1; line-height: 1.3;">
                  ${p.recommendedAction}
                </div>
              </div>
            `;

            if (cloudPopupRef.current) {
              cloudPopupRef.current.remove();
            }

            cloudPopupRef.current = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 10,
              className: "cloud-mask-tooltip-popup",
            })
              .setLngLat(coords)
              .setHTML(popupHtml)
              .addTo(map);
          });

          map.on("mouseleave", fillLayerId, () => {
            map.getCanvas().style.cursor = "";
            if (cloudPopupRef.current) {
              cloudPopupRef.current.remove();
              cloudPopupRef.current = null;
            }
          });
        }
      }
    }, []);

    const initializeMap = () => {
      if (!containerRef.current) return;

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }

      setHasError(false);
      setIsLoaded(false);

      const initialMapStyle = resolvedTheme === "light" ? MAPLIBRE_CONFIG.lightStyle : MAPLIBRE_CONFIG.darkStyle;
      const fallbackMapStyle = resolvedTheme === "light" ? MAPLIBRE_CONFIG.lightFallbackStyle : MAPLIBRE_CONFIG.fallbackStyle;

      try {
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: initialMapStyle,
          center: [initialCameraRef.current.lng, initialCameraRef.current.lat],
          zoom: initialCameraRef.current.zoom,
          minZoom: MAPLIBRE_CONFIG.minZoom,
          maxZoom: MAPLIBRE_CONFIG.maxZoom,
          attributionControl: false,
        });

        mapInstanceRef.current = map;

        const markLoaded = () => {
          setIsLoaded(true);
          setHasError(false);
          map.resize();
          reconcileForestLayers(map, forestGeoJsonRef.current, isForestLayerActive);
          reconcileIndustrialLayers(map, industrialGeoJsonRef.current);
          reconcileCloudMaskLayers(map, isCloudMaskActive);
          reconcileEmergencyServicesLayers(map, emergencyData, isEmergencyLayerActive);
          reconcileHistoricalDisastersLayers(map, disastersData, isDisasterLayerActive);
          reconcileMultimodalBenchmarkLayers(map, benchmarkData, isBenchmarkLayerActive);
          reconcileIndiaBoundariesLayers(map, boundariesData, isBoundariesLayerActive);
          reconcileCameoHazmatLayers(map, selectedEvent, isHazmatLayerActive);
        };

        if (map.loaded()) {
          markLoaded();
        } else {
          map.once("load", markLoaded);
        }

        // Reconcile layers on any style update / reload
        map.on("styledata", () => {
          if (map.isStyleLoaded()) {
            reconcileForestLayers(map, forestGeoJsonRef.current, isForestLayerActive);
            reconcileIndustrialLayers(map, industrialGeoJsonRef.current);
            reconcileCloudMaskLayers(map, isCloudMaskActive);
            reconcileEmergencyServicesLayers(map, emergencyData, isEmergencyLayerActive);
            reconcileHistoricalDisastersLayers(map, disastersData, isDisasterLayerActive);
            reconcileMultimodalBenchmarkLayers(map, benchmarkData, isBenchmarkLayerActive);
            reconcileIndiaBoundariesLayers(map, boundariesData, isBoundariesLayerActive);
            reconcileCameoHazmatLayers(map, selectedEvent, isHazmatLayerActive);
          }
        });

        map.on("error", (e) => {
          const isStyleOrTileError =
            !fallbackAttemptedRef.current &&
            (e.error?.message?.toLowerCase().includes("style") ||
              e.error?.message?.toLowerCase().includes("tile") ||
              e.error?.message?.toLowerCase().includes("fetch") ||
              (e as any).status === 404 ||
              (e as any).status === 0);

          if (isStyleOrTileError) {
            fallbackAttemptedRef.current = true;
            console.warn("MapLibre style error, applying fallback:", e);
            try {
              map.setStyle(fallbackMapStyle as any);
              map.once("styledata", () => {
                markLoaded();
              });
            } catch (fallbackErr) {
              console.error("MapLibre fallback failed:", fallbackErr);
              setHasError(true);
              setErrorMessage("Unable to initialize cartography raster or vector tiles.");
            }
          }
        });

        const safetyTimer = setTimeout(() => {
          if (!map.loaded() && !fallbackAttemptedRef.current) {
            fallbackAttemptedRef.current = true;
            try {
              map.setStyle(fallbackMapStyle as any);
              map.once("styledata", () => {
                markLoaded();
              });
            } catch (fallbackErr) {
              setHasError(true);
            }
          }
        }, 2500);

        let moveDebounceTimer: NodeJS.Timeout | null = null;
        map.on("moveend", () => {
          if (onCameraChangeRef.current) {
            const center = map.getCenter();
            const zoom = map.getZoom();
            onCameraChangeRef.current(center.lat, center.lng, zoom);
          }

          // Dynamic viewport bounding-box query for global forest loading
          if (moveDebounceTimer) clearTimeout(moveDebounceTimer);
          moveDebounceTimer = setTimeout(() => {
            const bounds = map.getBounds();
            const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
            fetchForestsGeoJson({ bbox, limit: 100 })
              .then((data) => {
                if (data && Array.isArray(data.features) && data.features.length > 0) {
                  // Merge incoming features with existing ones to avoid disappearing
                  const existingIds = new Set(forestGeoJsonRef.current.features.map((f) => f.properties.forest_id || f.id));
                  const merged = [...forestGeoJsonRef.current.features];
                  for (const f of data.features) {
                    const id = f.properties.forest_id || f.id;
                    if (!existingIds.has(id)) {
                      merged.push(f);
                      existingIds.add(id);
                    }
                  }
                  const updatedCollection = { ...forestGeoJsonRef.current, features: merged };
                  forestGeoJsonRef.current = updatedCollection;
                  setForestData(updatedCollection);
                  if (mapInstanceRef.current && mapInstanceRef.current.isStyleLoaded()) {
                    reconcileForestLayers(mapInstanceRef.current, updatedCollection, isForestLayerActive);
                  }
                }
              })
              .catch(() => {});
          }, 400);
        });

        const resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.resize();
          }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
          clearTimeout(safetyTimer);
          if (moveDebounceTimer) clearTimeout(moveDebounceTimer);
          resizeObserver.disconnect();
          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove();
            hoverPopupRef.current = null;
          }
          if (industrialPopupRef.current) {
            industrialPopupRef.current.remove();
            industrialPopupRef.current = null;
          }
          if (emergencyPopupRef.current) {
            emergencyPopupRef.current.remove();
            emergencyPopupRef.current = null;
          }
          if (disasterPopupRef.current) {
            disasterPopupRef.current.remove();
            disasterPopupRef.current = null;
          }
          markerMapRef.current.forEach((rec) => rec.marker.remove());
          markerMapRef.current.clear();
          if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
          }
        };
      } catch (err) {
        console.error("Failed to initialize MapLibre GL:", err);
        setHasError(true);
        setErrorMessage(err instanceof Error ? err.message : "Map initialization error");
      }
    };

    useEffect(() => {
      const cleanup = initializeMap();
      return () => {
        cleanup?.();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initCount]);

    // Switch map style dynamically when user toggles Light/Dark theme
    useEffect(() => {
       const map = mapInstanceRef.current;
       if (!map || !isLoaded) return;
       if (currentThemeRef.current === resolvedTheme) return;
       currentThemeRef.current = resolvedTheme;
       const targetStyle = resolvedTheme === "light" ? MAPLIBRE_CONFIG.lightStyle : MAPLIBRE_CONFIG.darkStyle;
       try {
         map.setStyle(targetStyle);
       } catch (err) {
         console.warn("Could not update map style dynamically:", err);
       }
     }, [resolvedTheme, isLoaded]);

    // Resilient industrial reconciliation caller that guarantees applying updates even if style is mid-stream
    const reconcileIndustrial = useCallback(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      if (map.isStyleLoaded()) {
        reconcileIndustrialLayers(map, filteredIndustrialData);
      } else {
        const onReady = () => {
          if (mapInstanceRef.current && mapInstanceRef.current.isStyleLoaded()) {
            reconcileIndustrialLayers(mapInstanceRef.current, filteredIndustrialData);
          }
        };
        map.once("idle", onReady);
        map.once("styledata", onReady);
      }
    }, [filteredIndustrialData, reconcileIndustrialLayers]);

    useEffect(() => {
      if (isVisible && mapInstanceRef.current) {
        mapInstanceRef.current.resize();
        reconcileIndustrial();
        const t1 = setTimeout(() => {
          mapInstanceRef.current?.resize();
          reconcileIndustrial();
        }, 40);
        const t2 = setTimeout(() => {
          mapInstanceRef.current?.resize();
          reconcileIndustrial();
        }, 160);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    }, [isVisible, reconcileIndustrial]);

    // Initial forest load
    useEffect(() => {
      let isCancelled = false;
      fetchForestsGeoJson({ limit: 100 })
        .then((data) => {
          if (isCancelled) return;
          forestGeoJsonRef.current = data;
          setForestData(data);
          if (mapInstanceRef.current && mapInstanceRef.current.isStyleLoaded()) {
            reconcileForestLayers(mapInstanceRef.current, data, isForestLayerActive);
          }
        })
        .catch((err) => {
          console.warn("Forest initial fetch fallback used:", err);
        });
      return () => {
        isCancelled = true;
      };
    }, [isForestLayerActive, reconcileForestLayers]);

    // Reconcile forest layer whenever activeLayers or forestData changes
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      if (map.isStyleLoaded()) {
        reconcileForestLayers(map, forestData, isForestLayerActive);
      }
    }, [forestData, isForestLayerActive, isLoaded, reconcileForestLayers]);

    // Reconcile industrial infrastructure layer whenever activeLayers or industrialData changes
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      reconcileIndustrial();
    }, [isLoaded, reconcileIndustrial]);

    // Reconcile sensor cloud mask layer whenever activeLayers changes
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      if (map.isStyleLoaded()) {
        reconcileCloudMaskLayers(map, isCloudMaskActive);
      }
    }, [isCloudMaskActive, isLoaded, reconcileCloudMaskLayers]);

    // Reconcile India Emergency Services Layer (Hospitals & Fire Stations)
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      if (map.isStyleLoaded()) {
        reconcileEmergencyServicesLayers(map, emergencyData, isEmergencyLayerActive);
      }
    }, [emergencyData, isEmergencyLayerActive, isLoaded, reconcileEmergencyServicesLayers]);

    // Reconcile Historical Industrial Disasters Benchmark Layer
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      if (map.isStyleLoaded()) {
        reconcileHistoricalDisastersLayers(map, disastersData, isDisasterLayerActive);
      }
    }, [disastersData, isDisasterLayerActive, isLoaded, reconcileHistoricalDisastersLayers]);

    // Reconcile Multi-Modal AI Ground-Truth Validation Benchmark Nodes Layer
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      if (map.isStyleLoaded()) {
        reconcileMultimodalBenchmarkLayers(map, benchmarkData, isBenchmarkLayerActive);
      }
    }, [benchmarkData, isBenchmarkLayerActive, isLoaded, reconcileMultimodalBenchmarkLayers]);

    // Reconcile India State & District Administrative Boundaries Layer
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      if (map.isStyleLoaded()) {
        reconcileIndiaBoundariesLayers(map, boundariesData, isBoundariesLayerActive);
      }
    }, [boundariesData, isBoundariesLayerActive, isLoaded, reconcileIndiaBoundariesLayers]);

    // Reconcile CAMEO-NIOSH Chemical Hazard & ERG Isolation Zones Layer
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      if (map.isStyleLoaded()) {
        reconcileCameoHazmatLayers(map, selectedEvent, isHazmatLayerActive);
      }
    }, [selectedEvent, isHazmatLayerActive, isLoaded, reconcileCameoHazmatLayers]);

    // Render & In-Place Reconcile Thermal Fire Markers on 2D Map
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;
      const currentMarkerMap = markerMapRef.current;
      const incomingEventIds = new Set(events.map((e) => e.event_id));

      for (const [id, record] of currentMarkerMap.entries()) {
        if (!incomingEventIds.has(id)) {
          record.marker.remove();
          currentMarkerMap.delete(id);
        }
      }

      events.forEach((event) => {
        const isSelected = selectedEvent?.event_id === event.event_id;
        const existing = currentMarkerMap.get(event.event_id);

        if (existing) {
          existing.event = event;
          (existing.element as any).__event = event;
          if (existing.isSelected !== isSelected) {
            updateFireMarkerSelection(existing.element, isSelected, event);
            existing.isSelected = isSelected;
          }
          if (
            existing.event.latitude !== event.latitude ||
            existing.event.longitude !== event.longitude
          ) {
            existing.marker.setLngLat([event.longitude, event.latitude]);
          }
        } else {
          const markerEl = createFireMarkerElement({
            event,
            isSelected,
            onSelect: (evt) => onSelectEventRef.current?.(evt),
          });

          const marker = new maplibregl.Marker({ element: markerEl })
            .setLngLat([event.longitude, event.latitude])
            .addTo(map);

          currentMarkerMap.set(event.event_id, {
            marker,
            element: markerEl,
            event,
            isSelected,
          });
        }
      });
    }, [events, selectedEvent, isLoaded]);

    // Render Authoritative Gaussian Plume, Centerline, Isolation & Evacuation Corridors on Event Selection
    useEffect(() => {
      if (!mapInstanceRef.current || !isLoaded) return;
      const map = mapInstanceRef.current;

      const plumeSourceId = "selected-incident-plume-source";
      const centerlineSourceId = "selected-incident-centerline-source";
      const isolationSourceId = "selected-incident-isolation-source";
      const evacSourceId = "selected-incident-evac-source";
      const forestRingsSourceId = "selected-forest-threat-rings-source";

      if (!selectedEvent || !dispersionGeoJson || dispersionGeoJson.features.length === 0) {
        if (map.getLayer("selected-incident-plume-fill")) map.removeLayer("selected-incident-plume-fill");
        if (map.getLayer("selected-incident-plume-line")) map.removeLayer("selected-incident-plume-line");
        if (map.getLayer("selected-incident-centerline-line")) map.removeLayer("selected-incident-centerline-line");
        if (map.getLayer("selected-incident-isolation-fill")) map.removeLayer("selected-incident-isolation-fill");
        if (map.getLayer("selected-incident-isolation-line")) map.removeLayer("selected-incident-isolation-line");
        if (map.getLayer("selected-incident-evac-fill")) map.removeLayer("selected-incident-evac-fill");
        if (map.getLayer("selected-incident-evac-line")) map.removeLayer("selected-incident-evac-line");
        if (map.getLayer("selected-forest-threat-rings-line")) map.removeLayer("selected-forest-threat-rings-line");
        if (map.getLayer("selected-forest-threat-rings-fill")) map.removeLayer("selected-forest-threat-rings-fill");

        if (map.getSource(plumeSourceId)) map.removeSource(plumeSourceId);
        if (map.getSource(centerlineSourceId)) map.removeSource(centerlineSourceId);
        if (map.getSource(isolationSourceId)) map.removeSource(isolationSourceId);
        if (map.getSource(evacSourceId)) map.removeSource(evacSourceId);
        if (map.getSource(forestRingsSourceId)) map.removeSource(forestRingsSourceId);
        return;
      }

      const plumeFeature = dispersionGeoJson.features.find((f) => f.id === "selected-incident-plume");
      const centerlineFeature = dispersionGeoJson.features.find((f) => f.id === "selected-incident-centerline");
      const isolationFeature = dispersionGeoJson.features.find((f) => f.id === "selected-incident-isolation-zone");
      const evacFeature = dispersionGeoJson.features.find((f) => f.id === "selected-incident-evacuation-corridor");

      const threatRingsCollection = computeForestThreatRings(
        selectedEvent.latitude,
        selectedEvent.longitude
      );

      // 1. Proximity Threat Buffer Rings Source & Layers for selected incident
      if (map.getSource(forestRingsSourceId)) {
        (map.getSource(forestRingsSourceId) as maplibregl.GeoJSONSource).setData(threatRingsCollection as any);
      } else {
        map.addSource(forestRingsSourceId, {
          type: "geojson",
          data: threatRingsCollection as any,
        });

        if (!map.getLayer("selected-forest-threat-rings-fill")) {
          map.addLayer(
            {
              id: "selected-forest-threat-rings-fill",
              type: "fill",
              source: forestRingsSourceId,
              paint: {
                "fill-color": [
                  "match",
                  ["get", "level"],
                  "CRITICAL",
                  "#ef4444",
                  "WARNING",
                  "#f59e0b",
                  "AWARENESS",
                  "#3b82f6",
                  "#10b981",
                ],
                "fill-opacity": [
                  "match",
                  ["get", "level"],
                  "CRITICAL",
                  0.08,
                  "WARNING",
                  0.05,
                  "AWARENESS",
                  0.03,
                  0.02,
                ],
              },
            },
            map.getLayer("forest-intelligence-fill") ? "forest-intelligence-fill" : undefined
          );
        }

        if (!map.getLayer("selected-forest-threat-rings-line")) {
          map.addLayer({
            id: "selected-forest-threat-rings-line",
            type: "line",
            source: forestRingsSourceId,
            paint: {
              "line-color": [
                "match",
                ["get", "level"],
                "CRITICAL",
                "#ef4444",
                "WARNING",
                "#f59e0b",
                "AWARENESS",
                "#3b82f6",
                "#10b981",
              ],
              "line-width": [
                "match",
                ["get", "level"],
                "CRITICAL",
                1.8,
                "WARNING",
                1.4,
                "AWARENESS",
                1.0,
                1.0,
              ],
              "line-dasharray": [3, 2],
              "line-opacity": 0.85,
            },
          });
        }
      }

      // 2. Real Gaussian Plume Hazard Polygon Source & Layers
      if (plumeFeature) {
        if (map.getSource(plumeSourceId)) {
          (map.getSource(plumeSourceId) as maplibregl.GeoJSONSource).setData(plumeFeature as any);
        } else {
          map.addSource(plumeSourceId, {
            type: "geojson",
            data: plumeFeature as any,
          });

          if (!map.getLayer("selected-incident-plume-fill")) {
            map.addLayer({
              id: "selected-incident-plume-fill",
              type: "fill",
              source: plumeSourceId,
              paint: {
                "fill-color": "#f97316",
                "fill-opacity": 0.28,
              },
            });
          }

          if (!map.getLayer("selected-incident-plume-line")) {
            map.addLayer({
              id: "selected-incident-plume-line",
              type: "line",
              source: plumeSourceId,
              paint: {
                "line-color": "#ea580c",
                "line-width": 1.8,
                "line-dasharray": [3, 2],
              },
            });
          }
        }
      }

      // 3. Centerline Trajectory LineString Source & Layer
      if (centerlineFeature) {
        if (map.getSource(centerlineSourceId)) {
          (map.getSource(centerlineSourceId) as maplibregl.GeoJSONSource).setData(centerlineFeature as any);
        } else {
          map.addSource(centerlineSourceId, {
            type: "geojson",
            data: centerlineFeature as any,
          });

          if (!map.getLayer("selected-incident-centerline-line")) {
            map.addLayer({
              id: "selected-incident-centerline-line",
              type: "line",
              source: centerlineSourceId,
              paint: {
                "line-color": "#06b6d4",
                "line-width": 2.2,
                "line-dasharray": [4, 3],
              },
            });
          }
        }
      }

      // 4. Immediate Isolation Boundary Source & Layers (200m)
      if (isolationFeature) {
        if (map.getSource(isolationSourceId)) {
          (map.getSource(isolationSourceId) as maplibregl.GeoJSONSource).setData(isolationFeature as any);
        } else {
          map.addSource(isolationSourceId, {
            type: "geojson",
            data: isolationFeature as any,
          });

          if (!map.getLayer("selected-incident-isolation-fill")) {
            map.addLayer({
              id: "selected-incident-isolation-fill",
              type: "fill",
              source: isolationSourceId,
              paint: {
                "fill-color": "#ef4444",
                "fill-opacity": 0.16,
              },
            });
          }

          if (!map.getLayer("selected-incident-isolation-line")) {
            map.addLayer({
              id: "selected-incident-isolation-line",
              type: "line",
              source: isolationSourceId,
              paint: {
                "line-color": "#dc2626",
                "line-width": 1.6,
              },
            });
          }
        }
      }

      // 5. Downwind Evacuation Boundary Source & Layers
      if (evacFeature) {
        if (map.getSource(evacSourceId)) {
          (map.getSource(evacSourceId) as maplibregl.GeoJSONSource).setData(evacFeature as any);
        } else {
          map.addSource(evacSourceId, {
            type: "geojson",
            data: evacFeature as any,
          });

          if (!map.getLayer("selected-incident-evac-fill")) {
            map.addLayer({
              id: "selected-incident-evac-fill",
              type: "fill",
              source: evacSourceId,
              paint: {
                "fill-color": "#f59e0b",
                "fill-opacity": 0.08,
              },
            });
          }

          if (!map.getLayer("selected-incident-evac-line")) {
            map.addLayer({
              id: "selected-incident-evac-line",
              type: "line",
              source: evacSourceId,
              paint: {
                "line-color": "#d97706",
                "line-width": 1.2,
                "line-dasharray": [2, 2],
              },
            });
          }
        }
      }
    }, [dispersionGeoJson, selectedEvent, isLoaded]);

    // Smooth Camera Fly-To on Event Selection
    useEffect(() => {
      if (!mapInstanceRef.current || !selectedEvent) return;
      const map = mapInstanceRef.current;
      map.flyTo({
        center: [selectedEvent.longitude, selectedEvent.latitude],
        zoom: Math.max(map.getZoom(), 8.0),
        duration: 1000,
        essential: true,
      });
    }, [selectedEvent]);

    const handleRetry = () => {
      setInitCount((c) => c + 1);
    };

    return (
      <div className={cn("relative w-full h-full min-h-full overflow-hidden select-none bg-background", className)}>
        <div ref={containerRef} className="w-full h-full min-h-full" />

        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm z-10 font-mono text-xs text-foreground-muted">
            <div className="w-8 h-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin mb-3" />
            <span className="tracking-wider uppercase">LOADING 2D GEOSPATIAL CARTOGRAPHY...</span>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md z-20 font-mono text-center p-6">
            <div className="w-12 h-12 rounded-panel bg-state-error/10 border border-state-error/30 flex items-center justify-center text-state-error mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-wider uppercase mb-1">
              GEOSPATIAL LAYER UNAVAILABLE
            </h3>
            <p className="text-xs text-foreground-muted max-w-sm mb-4">
              {errorMessage || "Unable to load cartography tiles. Fire intelligence data remains active and accessible."}
            </p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface-raised border border-border hover:border-accent text-xs font-semibold text-foreground hover:text-accent rounded-control transition-colors shadow-panel active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>RETRY / LOAD FALLBACK BASEMAP</span>
            </button>
          </div>
        )}

        {/* Subtle bottom-right basemap attribution */}
        <div className="absolute bottom-1 right-2 z-10 text-[9px] font-mono text-foreground-muted/60 pointer-events-none select-none">
          © CARTO © Esri © OpenStreetMap contributors
        </div>
      </div>
    );
  }
);
