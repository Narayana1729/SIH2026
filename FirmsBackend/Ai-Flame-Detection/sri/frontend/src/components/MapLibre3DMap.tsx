import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Incident, FacilityMarker, EmergencyResponder } from '../types';
import { Compass, Layers, RotateCcw } from 'lucide-react';

interface MapLibre3DMapProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (inc: Incident) => void;
  facilities?: FacilityMarker[];
  emergencyResponders: EmergencyResponder[];
  liveHotspots: any[];
}

export function MapLibre3DMap({
  incidents,
  selectedIncident,
  onSelectIncident,
  emergencyResponders,
  liveHotspots,
}: MapLibre3DMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [cursorCoords, setCursorCoords] = useState<{ lng: number; lat: number } | null>(null);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [78.9629, 20.5937], // India center
      zoom: 4.8,
      pitch: 45, // 3D Pitch angle
      bearing: -10, // 3D Bearing
      attributionControl: false,
    });

    mapRef.current = map;

    // Controls
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    map.on('mousemove', (e: any) => {
      if (e?.lngLat) {
        setCursorCoords({
          lng: Number(e.lngLat.lng.toFixed(4)),
          lat: Number(e.lngLat.lat.toFixed(4)),
        });
      }
    });

    map.on('load', () => {
      setIsLoaded(true);

      // Add Atmospheric Fog
      try {
        (map as any).setFog({
          color: 'rgba(5, 10, 24, 0.9)',
          'high-color': 'rgba(14, 28, 54, 0.8)',
          'horizon-blend': 0.08,
          'space-color': 'rgba(2, 6, 16, 1.0)',
          'star-intensity': 0.35,
        });
      } catch (err) {
        console.log('Fog not supported', err);
      }

      // 1. Add Live FIRMS Satellite GeoJSON Source
      map.addSource('live-firms-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // FIRMS Heat Glow Layer
      map.addLayer({
        id: 'firms-heat-glow',
        type: 'circle',
        source: 'live-firms-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'frp_mw'], 5, 6, 50, 14, 200, 24],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.45,
          'circle-blur': 0.8,
        },
      });

      // FIRMS Core Hotspot Points
      map.addLayer({
        id: 'firms-hotspots-core',
        type: 'circle',
        source: 'live-firms-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'frp_mw'], 5, 3.5, 50, 7, 200, 11],
          'circle-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-opacity': 0.95,
        },
      });

      // 2. Add Benchmark Incidents Source
      map.addSource('incidents-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Benchmark Incidents Pulse Layer
      map.addLayer({
        id: 'incidents-pulse',
        type: 'circle',
        source: 'incidents-source',
        paint: {
          'circle-radius': 18,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.35,
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
        },
      });

      map.addLayer({
        id: 'incidents-core',
        type: 'circle',
        source: 'incidents-source',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // 3. Add Fire Station Emergency Hubs Source
      map.addSource('fire-stations-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'fire-stations-layer',
        type: 'circle',
        source: 'fire-stations-source',
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#0284c7',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#e0f2fe',
          'circle-opacity': 0.9,
        },
      });

      // Hover & Click Interactions
      const setupInteractiveLayer = (layerId: string) => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });

        map.on('click', layerId, (e: any) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const props = feat.properties || {};

          const clickedIncident: Incident = {
            id: props.id || props.event_id || 'LIVE_HOTSPOT',
            title: props.title || props.source || 'NASA Live Hotspot',
            category: props.category || (props.predicted_class_id === 1 ? 'accidental' : 'routine'),
            confidence: props.confidence_score || 95,
            subtitle: props.subtitle || `${props.satellite || 'Satellite'} live detection`,
            facility: props.facility || props.site_name || 'Industrial Infrastructure Area',
            state: props.state || 'India',
            sector: props.sector || 'Energy / Petrochemicals',
            severity: (props.frp_mw || props.frpMw || 15) > 60 ? 'high' : 'medium',
            lat: (feat.geometry as any).coordinates[1],
            lon: (feat.geometry as any).coordinates[0],
            tempK: props.tempK || props.estimated_emitter_temp_k || 950,
            frpMw: props.frpMw || props.frp_mw || 25.0,
            areaM2: props.areaM2 || props.estimated_emitter_area_m2 || 45.0,
            windSpeed: props.windSpeed || '12.5 km/h',
            windDir: props.windDir || 'SW → NE',
            chemicals: ['Hydrocarbons (VOC)', 'SO2'],
            unNumber: 'UN 1993',
            evacRadiusKm: 0.5,
            dayIndex: 15,
            caseId: props.caseId || props.event_id,
          };

          onSelectIncident(clickedIncident);

          // Smooth 3D fly to on click
          map.flyTo({
            center: (feat.geometry as any).coordinates,
            zoom: 9.5,
            pitch: 55,
            bearing: -20,
            duration: 1500,
          });
        });
      };

      setupInteractiveLayer('firms-hotspots-core');
      setupInteractiveLayer('incidents-core');
      setupInteractiveLayer('fire-stations-layer');
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onSelectIncident]);

  // Update Live FIRMS GeoJSON
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const src = mapRef.current.getSource('live-firms-source') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (liveHotspots && liveHotspots.length > 0) {
      src.setData({
        type: 'FeatureCollection',
        features: liveHotspots,
      });
    }
  }, [liveHotspots, isLoaded]);

  // Update Benchmark Incidents GeoJSON
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const src = mapRef.current.getSource('incidents-source') as maplibregl.GeoJSONSource;
    if (!src) return;

    const features = incidents.map((inc) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [inc.lon, inc.lat],
      },
      properties: {
        ...inc,
        color:
          inc.category === 'accidental' ? '#ef4444' :
          inc.category === 'routine' ? '#f97316' :
          inc.category === 'wildfire' ? '#10b981' :
          inc.category === 'coal' ? '#8b5cf6' : '#eab308',
      },
    }));

    src.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [incidents, isLoaded]);

  // Update Fire Stations GeoJSON
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const src = mapRef.current.getSource('fire-stations-source') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (emergencyResponders && emergencyResponders.length > 0) {
      const features = emergencyResponders.map((resp) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [resp.lon, resp.lat],
        },
        properties: {
          title: resp.name,
          category: 'Emergency Dispatch Hub',
          facility: resp.name,
          state: resp.state,
          severity: 'low',
          frpMw: 0,
        },
      }));

      src.setData({
        type: 'FeatureCollection',
        features,
      });
    }
  }, [emergencyResponders, isLoaded]);

  // Fly to Selected Incident
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !selectedIncident) return;
    mapRef.current.flyTo({
      center: [selectedIncident.lon, selectedIncident.lat],
      zoom: 8.5,
      pitch: is3DMode ? 50 : 0,
      duration: 1200,
    });
  }, [selectedIncident, isLoaded, is3DMode]);

  // Toggle 3D Pitch
  const toggle3D = () => {
    if (!mapRef.current) return;
    const next3D = !is3DMode;
    setIs3DMode(next3D);
    mapRef.current.easeTo({
      pitch: next3D ? 50 : 0,
      bearing: next3D ? -15 : 0,
      duration: 800,
    });
  };

  const resetView = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [78.9629, 20.5937],
      zoom: 4.8,
      pitch: 45,
      bearing: -10,
      duration: 1000,
    });
  };

  return (
    <div className="w-full h-full relative bg-[#04060a] overflow-hidden">
      {/* MapLibre WebGL Viewport */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating 3D Vector HUD Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="px-3.5 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-800 text-white shadow-xl flex items-center gap-3 pointer-events-auto">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Compass className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <span>MapLibre 3D Vector Engine</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-mono font-bold">
                GL 3D
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Pitch: {is3DMode ? '50° Extruded' : '0° Orthographic'} · Space Fog Active
            </div>
          </div>
        </div>

        {/* Coords Tag */}
        {cursorCoords && (
          <div className="px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-400 pointer-events-auto w-fit">
            GPS: {cursorCoords.lat.toFixed(4)}°N, {cursorCoords.lng.toFixed(4)}°E
          </div>
        )}
      </div>

      {/* Quick 3D Pitch Toggle on Top Right */}
      <div className="absolute top-4 right-14 z-10 flex items-center gap-2">
        <button
          onClick={toggle3D}
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 ${
            is3DMode
              ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-cyan-900/30'
              : 'bg-slate-950/90 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Toggle 3D Pitch Perspective"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{is3DMode ? '3D Mode ON' : '2D Mode'}</span>
        </button>

        <button
          onClick={resetView}
          className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shadow-lg"
          title="Reset to India View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
