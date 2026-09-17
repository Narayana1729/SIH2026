import { useState, useEffect, useMemo } from 'react';
import { MinimalMap, type ForestReserve } from './components/MinimalMap';
import { MapLibre3DMap } from './components/MapLibre3DMap';
import { PlumeTacticalPanel } from './components/PlumeTacticalPanel';
import { LayersPanel } from './components/LayersPanel';
import { LayerInfoModal } from './components/LayerInfoModal';
import { TimeRangeControls, type TimeRange } from './components/TimeRangeControls';
import { DraggablePanel } from './components/DraggablePanel';
import { XAIEvidenceCard } from './components/XAIEvidenceCard';
import { InteractiveClassifierModal } from './components/InteractiveClassifierModal';
import { QuickScenariosBar } from './components/QuickScenariosBar';
import { UserGuideModal } from './components/UserGuideModal';
import { ToastNotification, type ToastMessage } from './components/ToastNotification';
import { LAYER_DEFINITIONS, type LayerDefinition } from './layersConfig';
import { calculatePlumeContours, type PlumeWeatherInput } from './engine/plumeEngine';
import { calculateDispatchPlan } from './engine/dispatchEngine';
import type { Incident, ActiveFilters, FacilityMarker, EmergencyResponder } from './types';
import { 
  Flame, 
  FileText, 
  X, 
  ShieldAlert, 
  Hospital, 
  Download, 
  CheckCircle2, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertTriangle, 
  SlidersHorizontal, 
  Sparkles, 
  Wind,
  Layers,
  Globe2,
  Sun,
  Moon
} from 'lucide-react';

const SEED_INCIDENTS: Incident[] = [
  {
    id: 'INC-001',
    caseId: 'HIST_DISASTER_VIZAG_2020',
    title: 'Accidental fire',
    category: 'accidental',
    confidence: 96,
    subtitle: 'Petrochem tank · FRP 11.5x baseline',
    facility: 'LG Polymers / HPCL Visakhapatnam Petrochem SEZ',
    state: 'Andhra Pradesh',
    sector: 'Refinery & Petrochemicals',
    severity: 'high',
    lat: 17.7607,
    lon: 83.2185,
    tempK: 1180,
    frpMw: 142.5,
    areaM2: 42.8,
    windSpeed: '18.5 km/h',
    windDir: 'SE → NW (315°)',
    chemicals: ['Styrene Monomer (UN2055)', 'Benzene (UN1114)', 'Naphtha (UN1268)'],
    unNumber: 'UN 2055',
    evacRadiusKm: 3.0,
    dayIndex: 21,
  },
  {
    id: 'INC-002',
    caseId: 'HIST_DISASTER_JAIPUR_2009',
    title: 'Petroleum depot explosion',
    category: 'accidental',
    confidence: 98,
    subtitle: 'Bulk terminal · FRP 111x baseline',
    facility: 'IOCL Bulk Petroleum Terminal, Sitapura',
    state: 'Rajasthan',
    sector: 'Refinery & Petrochemicals',
    severity: 'high',
    lat: 26.7925,
    lon: 75.8272,
    tempK: 1250,
    frpMw: 890.5,
    areaM2: 2800.0,
    windSpeed: '16.2 km/h',
    windDir: 'SW → NE (45°)',
    chemicals: ['Motor Spirit (Petrol)', 'Diesel', 'Kerosene (UN1268)'],
    unNumber: 'UN 1268',
    evacRadiusKm: 5.0,
    dayIndex: 14,
  },
  {
    id: 'INC-003',
    caseId: 'HIST_ROUTINE_JAMNAGAR_FLARE',
    title: 'Persistent flare stack',
    category: 'routine',
    confidence: 97,
    subtitle: 'Reliance Jamnagar FCCU unit',
    facility: 'Reliance Jamnagar Refinery Complex',
    state: 'Gujarat',
    sector: 'Refinery & Petrochemicals',
    severity: 'low',
    lat: 22.3556,
    lon: 69.8653,
    tempK: 1650,
    frpMw: 44.0,
    areaM2: 18.5,
    windSpeed: '15.4 km/h',
    windDir: 'SW → NE (45°)',
    chemicals: ['Hydrocarbons (LPG/Methane)', 'SO2'],
    unNumber: 'UN 1075',
    evacRadiusKm: 0.5,
    dayIndex: 21,
  },
  {
    id: 'INC-004',
    caseId: 'HIST_ROUTINE_TATA_STEEL_BLAST',
    title: 'Blast furnace operations',
    category: 'routine',
    confidence: 94,
    subtitle: 'Continuous smelter · baseline matched',
    facility: 'Tata Steel Jamshedpur Works',
    state: 'Jharkhand',
    sector: 'Iron & Steel',
    severity: 'low',
    lat: 22.8046,
    lon: 86.2029,
    tempK: 1400,
    frpMw: 24.1,
    areaM2: 45.0,
    windSpeed: '7.5 km/h',
    windDir: 'W → E (90°)',
    chemicals: ['Liquid Molten Iron', 'Blast Furnace Gas (CO)'],
    unNumber: 'UN 1910',
    evacRadiusKm: 0.2,
    dayIndex: 10,
  },
  {
    id: 'INC-005',
    caseId: 'HIST_MINING_JHARIA_COAL_FIRE',
    title: 'Coal seam smoldering',
    category: 'coal',
    confidence: 91,
    subtitle: 'Subsurface seam · mining zone',
    facility: 'BCCL Jharia Coalfield Block IV',
    state: 'Jharkhand',
    sector: 'Coal Mining',
    severity: 'medium',
    lat: 23.7431,
    lon: 86.4172,
    tempK: 710,
    frpMw: 28.5,
    areaM2: 450.0,
    windSpeed: '8.5 km/h',
    windDir: 'E → W (270°)',
    chemicals: ['CO', 'Methane (CH4)', 'Sulfur Dioxide (SO2)'],
    unNumber: 'UN 1361',
    evacRadiusKm: 1.2,
    dayIndex: 18,
  },
  {
    id: 'INC-006',
    caseId: 'HIST_AGRO_PUNJAB_STUBBLE_2023',
    title: 'Crop stubble burning',
    category: 'crop',
    confidence: 93,
    subtitle: 'Rural belt · seasonal pattern',
    facility: 'Sangrur Agricultural Paddy Belt',
    state: 'Punjab',
    sector: 'Agriculture',
    severity: 'medium',
    lat: 30.2458,
    lon: 75.8421,
    tempK: 820,
    frpMw: 36.8,
    areaM2: 210.0,
    windSpeed: '14.0 km/h',
    windDir: 'NW → SE (120°)',
    chemicals: ['Biomass Smoke (PM2.5, CO, VOCs)'],
    unNumber: 'N/A',
    evacRadiusKm: 0.8,
    dayIndex: 5,
  },
  {
    id: 'INC-007',
    caseId: 'HIST_WILDFIRE_SIMLIPAL_2021',
    title: 'Forest canopy wildfire',
    category: 'wildfire',
    confidence: 95,
    subtitle: 'Protected biosphere reserve',
    facility: 'Simlipal Biosphere Reserve Core',
    state: 'Odisha',
    sector: 'Forestry',
    severity: 'medium',
    lat: 21.8653,
    lon: 86.3475,
    tempK: 680,
    frpMw: 310.0,
    areaM2: 45000.0,
    windSpeed: '14.8 km/h',
    windDir: 'NW → SE (135°)',
    chemicals: ['Dry Sal Leaf Biomass (PM2.5)'],
    unNumber: 'N/A',
    evacRadiusKm: 0.0,
    dayIndex: 8,
  },
  {
    id: 'INC-008',
    title: 'Solar glint reflection',
    category: 'glint',
    confidence: 42,
    subtitle: 'Photovoltaic reflection · false positive',
    facility: 'Bhadla Solar Park Boundary Sector 4',
    state: 'Rajasthan',
    sector: 'Solar & Renewable',
    severity: 'low',
    lat: 27.538,
    lon: 71.916,
    tempK: 330,
    frpMw: 1.2,
    areaM2: 150.0,
    windSpeed: '9.0 km/h',
    windDir: 'NW → SE (135°)',
    chemicals: ['None (Photovoltaic Optical Glint)'],
    unNumber: 'N/A',
    evacRadiusKm: 0.0,
    dayIndex: 12,
  }
];

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(SEED_INCIDENTS[0]);
  const [showDossierDrawer, setShowDossierDrawer] = useState<boolean>(false);
  const [showClassifierModal, setShowClassifierModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showAllPanels, setShowAllPanels] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState<boolean>(false);
  const [showPlumePanel, setShowPlumePanel] = useState<boolean>(true);
  const [mapViewMode, setMapViewMode] = useState<'2d' | '3d'>('2d');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const [plumeWeather, setPlumeWeather] = useState<PlumeWeatherInput>({
    windSpeed: 4.8,
    windDirection: 270,
    stability: 'NEUTRAL',
  });

  // Database Datasets
  const [facilities, setFacilities] = useState<FacilityMarker[]>([]);
  const [emergencyResponders, setEmergencyResponders] = useState<EmergencyResponder[]>([]);
  const [forestReserves, setForestReserves] = useState<ForestReserve[]>([]);
  const [liveFirmsHotspots, setLiveFirmsHotspots] = useState<any[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Dynamic Gaussian Plume Dispersion Model
  const plumeData = useMemo(() => {
    if (!selectedIncident) return null;
    return calculatePlumeContours({
      sourceLon: selectedIncident.lon,
      sourceLat: selectedIncident.lat,
      severity: selectedIncident.severity,
      frpMw: selectedIncident.frpMw,
      category: selectedIncident.category,
      weather: plumeWeather,
      sourceId: selectedIncident.id,
      sourceName: selectedIncident.facility,
    });
  }, [selectedIncident, plumeWeather]);

  // Emergency Dispatch Calculation
  const dispatchPlan = useMemo(() => {
    if (!selectedIncident || emergencyResponders.length === 0) return null;
    return calculateDispatchPlan(
      selectedIncident.lat,
      selectedIncident.lon,
      selectedIncident.id,
      emergencyResponders
    );
  }, [selectedIncident, emergencyResponders]);

  // Theme State ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pyrosat-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('pyrosat-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Time Range Filter State
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('today');
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-01');

  // Metadata Inspector Modal State
  const [inspectedLayer, setInspectedLayer] = useState<LayerDefinition | null>(null);

  // Central Active Layers State
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    LAYER_DEFINITIONS.forEach(l => {
      initial[l.id] = l.defaultEnabled;
    });
    return initial;
  });

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<ActiveFilters>({
    state: null,
    sector: null,
    severity: null,
    category: null,
    dayFilterActive: false,
  });

  // Load datasets from backend APIs
  useEffect(() => {
    // 1. Fetch 1,704 Master Industrial Facilities
    fetch('/api/facilities')
      .then(res => res.json())
      .then(data => {
        if (data.features) {
          const mapped: FacilityMarker[] = data.features.map((f: any) => ({
            name: f.properties?.name || 'Industrial Facility',
            category: f.properties?.category || f.properties?.type || 'Industrial',
            type: f.properties?.type || 'Factory',
            lat: f.geometry?.coordinates[1],
            lon: f.geometry?.coordinates[0],
            capacityMw: f.properties?.capacity_mw,
          })).filter((f: any) => f.lat && f.lon);
          setFacilities(mapped);
        }
      })
      .catch(() => {});

    // 2. Fetch Emergency Services Database
    fetch('/api/emergency-responders')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setEmergencyResponders(data);
        }
      })
      .catch(() => {});

    // 3. Fetch Forest Reserves
    fetch('/api/forest-reserves')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setForestReserves(data);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Live NASA FIRMS API Stream
  const fetchLiveFirms = (dateStr: string = selectedDate, range: TimeRange = selectedTimeRange) => {
    const days = range === '7d' ? 7 : (range === '24h' ? 2 : 1);
    const queryDate = dateStr || '2026-08-25';
    setIsRefreshingFeed(true);
    fetch(`/api/live-firms?days=${days}&date=${queryDate}`)
      .then(res => res.json())
      .then(data => {
        if (data.features && Array.isArray(data.features)) {
          setLiveFirmsHotspots(data.features);
        }
        setIsRefreshingFeed(false);
      })
      .catch(() => setIsRefreshingFeed(false));
  };

  useEffect(() => {
    if (activeLayers['nasa-firms-live-api'] || activeLayers['nasa-firms-viirs']) {
      fetchLiveFirms(selectedDate, selectedTimeRange);
    }
  }, [activeLayers['nasa-firms-live-api'], activeLayers['nasa-firms-viirs'], selectedDate, selectedTimeRange]);

  // Available Filter Options
  const availableStates = useMemo(() => {
    const states = Array.from(new Set(incidents.map(i => i.state).filter(Boolean)));
    return ['All States', ...states.sort()];
  }, [incidents]);

  const availableSectors = useMemo(() => {
    const sectors = Array.from(new Set(incidents.map(i => i.sector).filter(Boolean)));
    return ['All Sectors', ...sectors.sort()];
  }, [incidents]);

  // Load telemetry from backend API
  const fetchTelemetry = () => {
    setIsRefreshingFeed(true);
    fetch('/api/thermal-events?limit=1400')
      .then(res => res.json())
      .then(data => {
        if (data.features && data.features.length > 0) {
          const mapped: Incident[] = data.features.map((f: any, idx: number) => {
            const p = f.properties;
            const cId = p.predicted_class_id;
            let cat: Incident['category'] = 'routine';
            let title = 'Kiln operation';
            let sev: Incident['severity'] = 'low';

            if (cId === 1) {
              cat = 'accidental';
              title = 'Accidental fire';
              sev = 'high';
            } else if (cId === 0) {
              cat = 'routine';
              title = idx % 3 === 0 ? 'Kiln operation' : 'Persistent flare';
              sev = 'low';
            } else if (cId === 2) {
              cat = 'wildfire';
              title = 'Forest wildfire';
              sev = 'medium';
            } else if (cId === 3) {
              cat = 'crop';
              title = 'Crop burning';
              sev = 'medium';
            } else if (cId === 4) {
              cat = 'coal';
              title = 'Coal smoldering';
              sev = 'medium';
            } else if (cId === 5) {
              cat = 'glint';
              title = 'Solar glint';
              sev = 'low';
            }

            let subtitle = `${p.nearest_facility || 'Industrial asset'} · FRP 4.2x baseline`;
            if (cat === 'routine') subtitle = `${p.nearest_facility || 'Industrial plant'} · routine flare`;
            if (cat === 'crop') subtitle = 'Rural belt · seasonal pattern';
            if (cat === 'glint') subtitle = 'Low confidence · false positive';
            if (cat === 'wildfire') subtitle = 'Protected canopy · biomass';
            if (cat === 'coal') subtitle = 'Subsurface seam · mining zone';

            let sector = 'Refinery & Petrochemicals';
            if (cat === 'coal') sector = 'Coal Mining';
            if (cat === 'crop') sector = 'Agriculture';
            if (cat === 'wildfire') sector = 'Forestry';
            if (cat === 'glint') sector = 'Solar & Renewable';
            if (idx % 4 === 1) sector = 'Iron & Steel';

            return {
              id: p.event_id || `INC-${idx + 1}`,
              caseId: p.event_id,
              title,
              category: cat,
              confidence: Math.round(p.confidence_score || 94),
              subtitle,
              facility: p.nearest_facility || p.site_name || 'Industrial Facility',
              state: p.region_split || 'India',
              sector,
              severity: sev,
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
              tempK: Math.round(p.estimated_emitter_temp_k || 1200),
              frpMw: parseFloat(p.frp_mw?.toFixed(1) || '25.0'),
              areaM2: parseFloat(p.estimated_emitter_area_m2?.toFixed(1) || '40.0'),
              windSpeed: '14.5 km/h',
              windDir: 'SW → NE (45°)',
              chemicals: ['Styrene Monomer (UN2055)', 'Benzene (UN1114)', 'SO2 (UN1079)'],
              unNumber: 'UN 2055',
              evacRadiusKm: cat === 'accidental' ? 2.8 : 0.4,
              dayIndex: (idx % 30) + 1
            };
          });

          const combined = [...SEED_INCIDENTS, ...mapped.filter(m => !SEED_INCIDENTS.some(s => s.id === m.id))];
          setIncidents(combined);
          setSelectedIncident(combined[0]);
          addToast('Live Feed Synchronized', `Ingested ${combined.length} thermal detections from FIRMS & PostGIS.`, 'success');
        }
      })
      .catch(() => {
        setIncidents(SEED_INCIDENTS);
        setSelectedIncident(SEED_INCIDENTS[0]);
      })
      .finally(() => {
        setIsRefreshingFeed(false);
      });
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  // Filter Pipeline
  const filteredIncidents = useMemo(() => {
    const selectedDayNum = parseInt(selectedDate.split('-')[2]) || 31;
    return incidents.filter((inc) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFacility = inc.facility.toLowerCase().includes(q);
        const matchesTitle = inc.title.toLowerCase().includes(q);
        const matchesState = inc.state.toLowerCase().includes(q);
        const matchesSector = inc.sector.toLowerCase().includes(q);
        const matchesId = inc.id.toLowerCase().includes(q);
        if (!matchesFacility && !matchesTitle && !matchesState && !matchesSector && !matchesId) {
          return false;
        }
      }

      if (filters.category && inc.category !== filters.category) return false;
      if (filters.state && filters.state !== 'All States' && inc.state !== filters.state) return false;
      if (filters.sector && filters.sector !== 'All Sectors' && inc.sector !== filters.sector) return false;
      if (filters.severity && filters.severity !== 'All Severities' && inc.severity !== filters.severity) return false;
      if (filters.dayFilterActive && inc.dayIndex !== selectedDayNum) return false;

      return true;
    });
  }, [incidents, searchQuery, filters, selectedDate]);

  const activeAlertsCount = useMemo(() => {
    return incidents.filter((i) => i.category === 'accidental' || i.severity === 'high').length;
  }, [incidents]);

  const handleExportPdf = () => {
    setIsExportingPdf(true);
    const caseId = selectedIncident?.caseId || 'HIST_DISASTER_VIZAG_2020';
    window.open(`/api/incident-dossier/${caseId}`, '_blank');
    addToast('Dossier Generated', 'Incident action plan exported successfully.', 'info');
    setTimeout(() => {
      setIsExportingPdf(false);
    }, 1200);
  };

  const handleToggleCategory = (cat: Incident['category'] | null) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category === cat ? null : cat
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      state: null,
      sector: null,
      severity: null,
      category: null,
      dayFilterActive: false,
    });
    setSearchQuery('');
    addToast('Filters Reset', 'All filter constraints have been cleared.', 'info');
  };

  // Central Layer Toggle Handler
  const handleToggleLayer = (layerId: string) => {
    setActiveLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  };

  const handleSelectScenario = (scenarioId: string) => {
    const match = incidents.find(i => i.id === scenarioId);
    if (match) {
      setSelectedIncident(match);
      setShowPlumePanel(true);
      addToast('Scenario Activated', `Loaded ${match.facility}`, 'info');
    }
  };

  const handleClassifiedEventCreated = (classifiedData: any) => {
    const c = classifiedData.classification;
    const p = classifiedData.physical_characterization;
    const s = classifiedData.spatial_attribution;
    const newInc: Incident = {
      id: `INC-SIM-${Date.now().toString().slice(-4)}`,
      caseId: 'SIMULATED_EVENT',
      title: c.predicted_class_name.replace(/_/g, ' '),
      category: c.predicted_class_id === 1 ? 'accidental' : (c.predicted_class_id === 0 ? 'routine' : (c.predicted_class_id === 2 ? 'wildfire' : (c.predicted_class_id === 3 ? 'crop' : 'coal'))),
      confidence: Math.round(c.confidence_score),
      subtitle: `${s.nearest_facility} · ${s.dist_km.toFixed(1)} km`,
      facility: s.nearest_facility,
      state: 'Classified Zone',
      sector: s.dominant_lulc,
      severity: c.predicted_class_id === 1 ? 'high' : 'medium',
      lat: classifiedData.event_coordinates[1],
      lon: classifiedData.event_coordinates[0],
      tempK: p.estimated_emitter_temp_k,
      frpMw: p.frp_mw,
      areaM2: p.estimated_emitter_area_m2,
      windSpeed: '14.2 km/h',
      windDir: 'SW → NE (45°)',
      chemicals: ['Combustion Byproducts', 'Thermal Radiation'],
      unNumber: 'UN 1993',
      evacRadiusKm: c.predicted_class_id === 1 ? 3.0 : 0.5,
      dayIndex: parseInt(selectedDate.split('-')[2]) || 31
    };
    setIncidents(prev => [newInc, ...prev]);
    setSelectedIncident(newInc);
    addToast('Event Pinned', `Created simulated incident at ${newInc.facility}.`, 'success');
  };

  return (
    <div className={`${theme === 'dark' ? 'dark ' : ''}h-screen w-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans select-none overflow-hidden`}>
      
      {/* 1. Header Bar */}
      <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm z-20">
        
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <h1 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>PyroSat</span>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-1 py-0.2 rounded border border-zinc-200 dark:border-zinc-800">
                v2.5
              </span>
            </h1>
            <div className="text-[10.5px] text-zinc-500 hidden sm:block">Thermal Anomaly & HAZMAT Intelligence</div>
          </div>
        </div>

        {/* Center: Search Input */}
        <div className="hidden md:flex items-center w-72 lg:w-80 relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facilities, states, sectors..."
            className="w-full bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-700 rounded-md pl-8 pr-7 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Map View Mode Switcher */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-0.5">
            <button
              onClick={() => setMapViewMode('2d')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                mapViewMode === '2d'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="2D Map View"
            >
              <Layers className="w-3 h-3" />
              <span>2D</span>
            </button>
            <button
              onClick={() => setMapViewMode('3d')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                mapViewMode === '3d'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="3D Globe View"
            >
              <Globe2 className="w-3 h-3" />
              <span>3D</span>
            </button>
          </div>

          {/* Theme Switcher Toggle (Light / Dark) */}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-zinc-600" />
            )}
          </button>

          {/* Plume Panel Toggle */}
          <button
            onClick={() => setShowPlumePanel(!showPlumePanel)}
            className={`px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              showPlumePanel
                ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
            title="Toggle Plume & Dispatch Panel"
          >
            <Wind className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span className="hidden sm:inline">Plume & Dispatch</span>
          </button>

          {/* Sync Live Button */}
          <button
            onClick={fetchTelemetry}
            disabled={isRefreshingFeed}
            className="px-2 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh Live Telemetry"
          >
            <RefreshCw className={`w-3 h-3 text-zinc-400 ${isRefreshingFeed ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* Active Alerts Pill */}
          <button
            onClick={() => setFilters(f => ({ ...f, category: f.category === 'accidental' ? null : 'accidental' }))}
            className={`px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              filters.category === 'accidental'
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/50'
                : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>{activeAlertsCount} Alerts</span>
          </button>

          {/* AI Classifier Lab Modal Button */}
          <button
            onClick={() => setShowClassifierModal(true)}
            className="px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-violet-500 dark:text-violet-400" />
            <span>Classifier Lab</span>
          </button>

          {/* Dossier Modal Button */}
          <button
            onClick={() => setShowDossierDrawer(true)}
            className="px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
            <span>Dossier</span>
          </button>
        </div>
      </header>

      {/* 2. Quick Scenarios & Tools Bar */}
      <QuickScenariosBar
        activeScenarioId={selectedIncident?.id}
        onSelectScenario={handleSelectScenario}
        onOpenGuide={() => setShowGuideModal(true)}
        showAllPanels={showAllPanels}
        onToggleAllPanels={() => setShowAllPanels(!showAllPanels)}
      />

      {/* 3. Filter & Category Toolbar */}
      <div className="h-9 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between bg-white/95 dark:bg-zinc-950 overflow-x-auto gap-2 text-xs">
        
        {/* Left: Category Quick Pills */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleToggleCategory(null)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
              filters.category === null
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            All ({incidents.length})
          </button>

          <button
            onClick={() => handleToggleCategory('accidental')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              filters.category === 'accidental'
                ? 'bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Accidental</span>
          </button>

          <button
            onClick={() => handleToggleCategory('routine')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              filters.category === 'routine'
                ? 'bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Routine</span>
          </button>

          <button
            onClick={() => handleToggleCategory('wildfire')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              filters.category === 'wildfire'
                ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Wildfire</span>
          </button>

          <button
            onClick={() => handleToggleCategory('crop')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              filters.category === 'crop'
                ? 'bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/40 text-sky-700 dark:text-sky-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span>Stubble</span>
          </button>

          <button
            onClick={() => handleToggleCategory('coal')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              filters.category === 'coal'
                ? 'bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/40 text-violet-700 dark:text-violet-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span>Coal</span>
          </button>

          <button
            onClick={() => handleToggleCategory('glint')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              filters.category === 'glint'
                ? 'bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            <span>Glint</span>
          </button>
        </div>

        {/* Right: Filter Chips & Trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          {filters.state && (
            <div className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs flex items-center gap-1">
              <span>{filters.state}</span>
              <button 
                onClick={() => setFilters(f => ({ ...f, state: null }))}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {filters.sector && (
            <div className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs flex items-center gap-1">
              <span>{filters.sector}</span>
              <button 
                onClick={() => setFilters(f => ({ ...f, sector: null }))}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button 
            onClick={() => setShowFilterModal(true)}
            className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
            <span>Filter</span>
          </button>

          {(filters.state || filters.sector || filters.severity || filters.category || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] text-rose-500 dark:text-rose-400 hover:underline px-1 cursor-pointer font-medium"
            >
              Reset
            </button>
          )}
        </div>

      </div>

      {/* 4. Main Dashboard Workspace (Map + Incidents Split Pane) */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Left: Map Workspace */}
        <div className="flex-1 flex flex-col border-r border-zinc-200 dark:border-zinc-800 relative">
          
          <div className="flex-1 w-full h-full relative">
            {mapViewMode === '2d' ? (
              <MinimalMap
                incidents={filteredIncidents}
                selectedIncident={selectedIncident}
                onSelectIncident={(inc) => setSelectedIncident(inc)}
                activeLayers={activeLayers}
                facilities={facilities}
                emergencyResponders={emergencyResponders}
                forestReserves={forestReserves}
                liveFirmsHotspots={liveFirmsHotspots}
                plumeData={plumeData?.featureCollection}
                dispatchPlan={dispatchPlan}
                showPlumes={showAllPanels}
                showDispatchRoutes={showAllPanels}
                theme={theme}
              />
            ) : (
              <MapLibre3DMap
                incidents={filteredIncidents}
                selectedIncident={selectedIncident}
                onSelectIncident={(inc) => setSelectedIncident(inc)}
                facilities={facilities}
                emergencyResponders={emergencyResponders}
                liveHotspots={liveFirmsHotspots}
              />
            )}

            {/* Overlays when enabled - preserved in DOM so dragged coordinates are remembered */}
            <div className={!showAllPanels ? 'hidden' : ''}>
              {/* Floating GIS Layers Panel */}
              <LayersPanel
                layerDefinitions={LAYER_DEFINITIONS}
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                onOpenInfo={(layer) => setInspectedLayer(layer)}
                onApplyPreset={(presetIds) => {
                  const updated: Record<string, boolean> = {};
                  LAYER_DEFINITIONS.forEach(l => {
                    updated[l.id] = presetIds.includes(l.id);
                  });
                  setActiveLayers(updated);
                }}
              />

              {/* Floating Time Controls */}
              <TimeRangeControls
                selectedRange={selectedTimeRange}
                onSelectRange={(range) => setSelectedTimeRange(range)}
                selectedDate={selectedDate}
                onSelectDate={(date) => setSelectedDate(date)}
              />

              {/* Hotspot Orbital Notice */}
              {liveFirmsHotspots.length === 0 && (
                <DraggablePanel defaultPosition={{ x: 380, y: 64 }} zIndex={400}>
                  <div className="drag-handle cursor-grab active:cursor-grabbing bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                      0 records for {selectedDate}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedDate("2026-08-25");
                        setSelectedTimeRange("custom");
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-[10.5px] hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Load Aug 25 Pass
                    </button>
                  </div>
                </DraggablePanel>
              )}

              {/* Floating Plume & Dispatch Tactical Panel */}
              {showPlumePanel && selectedIncident && (
                <DraggablePanel defaultPosition={{ x: 740, y: 16 }} zIndex={450} className="w-[360px] max-w-[calc(100vw-2rem)]">
                  <PlumeTacticalPanel
                    selectedIncident={selectedIncident}
                    weather={plumeWeather}
                    telemetry={plumeData?.telemetry || null}
                    dispatchPlan={dispatchPlan}
                    onWeatherChange={(updated) => setPlumeWeather((prev) => ({ ...prev, ...updated }))}
                    onSelectResponder={() => {}}
                    onShowToast={addToast}
                    onClose={() => setShowPlumePanel(false)}
                  />
                </DraggablePanel>
              )}
            </div>
          </div>

          {/* NASA FIRMS Bottom Timeline Ribbon */}
          <div className="h-10 border-t border-zinc-200 dark:border-zinc-800 px-3 flex items-center justify-between bg-white dark:bg-zinc-950 gap-2 select-none overflow-x-auto font-mono text-xs">
            {/* Month Badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10.5px] font-medium">
                August 2026
              </span>
            </div>

            {/* Days 1 to 31 Selector */}
            <div className="flex items-center gap-0.5 overflow-x-auto py-1 px-1 scrollbar-none">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const dayStr = `2026-08-${String(day).padStart(2, '0')}`;
                const isSelected = selectedDate === dayStr;
                const hasData = day <= 25;

                return (
                  <button
                    key={day}
                    onClick={() => {
                      setSelectedDate(dayStr);
                      setSelectedTimeRange('custom');
                    }}
                    className={`min-w-[24px] h-6 px-0.5 rounded text-[10.5px] transition-colors cursor-pointer flex flex-col items-center justify-center relative ${
                      isSelected
                        ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-400 dark:border-zinc-600 font-bold'
                        : 'bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-850'
                    }`}
                  >
                    <span>{day}</span>
                    {hasData && (
                      <span className={`w-0.5 h-0.5 rounded-full ${isSelected ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Steppers & Active Date */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  const currentDayNum = parseInt(selectedDate.split('-')[2]);
                  const prevDay = Math.max(1, currentDayNum - 1);
                  const newDate = `2026-08-${String(prevDay).padStart(2, '0')}`;
                  setSelectedDate(newDate);
                  setSelectedTimeRange('custom');
                }}
                className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10.5px] cursor-pointer"
                title="Previous Day"
              >
                ◀
              </button>

              <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10.5px]">
                {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>

              <button
                onClick={() => {
                  const currentDayNum = parseInt(selectedDate.split('-')[2]);
                  const nextDay = Math.min(31, currentDayNum + 1);
                  const newDate = `2026-08-${String(nextDay).padStart(2, '0')}`;
                  setSelectedDate(newDate);
                  setSelectedTimeRange('custom');
                }}
                className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10.5px] cursor-pointer"
                title="Next Day"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        {/* Right: Incidents Sidebar List */}
        <div className="w-[340px] xl:w-[380px] flex flex-col bg-slate-50 dark:bg-zinc-950 p-3.5 overflow-y-auto border-l border-zinc-200 dark:border-zinc-800">
          
          <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2.5">
            <span>Thermal Events ({filteredIncidents.length})</span>
            {filters.category && (
              <span className="text-[10px] text-zinc-500 font-mono uppercase">
                {filters.category}
              </span>
            )}
          </div>

          {/* Cards Stack */}
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {filteredIncidents.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-2">
                <Filter className="w-5 h-5 mx-auto text-zinc-400 dark:text-zinc-600" />
                <div>No events match active filters</div>
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer border border-zinc-200 dark:border-zinc-800"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                const isAccidental = inc.category === 'accidental';

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`p-3 rounded-lg transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100'
                        : 'bg-white/70 dark:bg-zinc-950 border-zinc-200/80 dark:border-zinc-800/80 hover:bg-white dark:hover:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{
                            backgroundColor: isAccidental ? '#ef4444' : (inc.category === 'routine' ? '#f59e0b' : (inc.category === 'wildfire' ? '#10b981' : '#0ea5e9'))
                          }}
                        />
                        <span className={`text-xs font-medium truncate ${
                          isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {inc.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {inc.confidence}%
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-500 mt-1 truncate">
                      {inc.subtitle}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[10.5px] text-zinc-500">
                      <span className="truncate max-w-[160px]">{inc.facility}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">{inc.frpMw} MW</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIncident(inc);
                            setShowPlumePanel(true);
                          }}
                          className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[10px] cursor-pointer"
                          title="Open Plume Simulation"
                        >
                          Plume
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Incident Telemetry & XAI Evidence Card */}
          {selectedIncident && (
            <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs shrink-0">
              <XAIEvidenceCard 
                incident={selectedIncident}  
                onDownloadDossier={(_caseId) => handleExportPdf()} 
              />
            </div>
          )}

        </div>
      </div>

      {/* 5. Filter Popover Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-zinc-800 dark:text-zinc-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Filter Events</h3>
              </div>
              <button 
                onClick={() => setShowFilterModal(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">State / Region</label>
              <select
                value={filters.state || 'All States'}
                onChange={(e) => setFilters(f => ({ ...f, state: e.target.value === 'All States' ? null : e.target.value }))}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
              >
                {availableStates.map(st => (
                  <option key={st} value={st} className="bg-white dark:bg-zinc-950">{st}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Industrial Sector</label>
              <select
                value={filters.sector || 'All Sectors'}
                onChange={(e) => setFilters(f => ({ ...f, sector: e.target.value === 'All Sectors' ? null : e.target.value }))}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
              >
                {availableSectors.map(sec => (
                  <option key={sec} value={sec} className="bg-white dark:bg-zinc-950">{sec}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Alert Severity</label>
              <div className="grid grid-cols-4 gap-1.5">
                {['All Severities', 'high', 'medium', 'low'].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setFilters(f => ({ ...f, severity: sev === 'All Severities' ? null : sev }))}
                    className={`py-1.5 rounded border text-xs capitalize transition-colors cursor-pointer ${
                      (filters.severity === sev) || (sev === 'All Severities' && !filters.severity)
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {sev === 'All Severities' ? 'All' : sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. First Responder HAZMAT Dossier Modal */}
      {showDossierDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-zinc-800 dark:text-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    First Responder HAZMAT Dossier
                  </h3>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    Incident: {selectedIncident?.id || 'INC-001'}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowDossierDrawer(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-0.5">
              <div className="text-[10.5px] text-zinc-500 font-medium">
                TARGET ASSET & GEOLOCATION
              </div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedIncident?.facility}
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
                {selectedIncident?.lat.toFixed(4)}°N, {selectedIncident?.lon.toFixed(4)}°E ({selectedIncident?.state})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                <div className="text-[10.5px] text-rose-600 dark:text-rose-400 font-medium">
                  HAZMAT INVENTORY
                </div>
                <div className="text-xs text-zinc-800 dark:text-zinc-300">
                  {selectedIncident?.chemicals.join(', ')}
                </div>
                <div className="text-[10px] text-zinc-500">
                  UN: {selectedIncident?.unNumber}
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-0.5">
                <div className="text-[10.5px] text-amber-600 dark:text-amber-400 font-medium">
                  DOWNWIND CORRIDOR
                </div>
                <div className="text-xs text-zinc-800 dark:text-zinc-300">
                  {selectedIncident?.evacRadiusKm} km Safety Radius
                </div>
                <div className="text-[10px] text-zinc-500">
                  Stability Class: Neutral
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <div className="text-[10.5px] text-zinc-500 font-medium flex items-center justify-between">
                <span>NEAREST EMERGENCY RESPONDERS</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" /> Ready</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <Hospital className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  King George Hospital Burn ICU (220 Beds)
                </span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">+91-891-2564891</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  Chemical Fire Station (16 Tenders)
                </span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">+91-891-2873101</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowDossierDrawer(false)}
                className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'Exporting...' : 'Export Action Plan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Live Anomaly Classifier Modal */}
      <InteractiveClassifierModal
        isOpen={showClassifierModal}
        onClose={() => setShowClassifierModal(false)}
        onClassifiedEventCreated={handleClassifiedEventCreated}
      />

      {/* 8. Layer Info Modal */}
      <LayerInfoModal
        layer={inspectedLayer}
        onClose={() => setInspectedLayer(null)}
      />

      {/* 9. User Guide Modal */}
      <UserGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        onSelectScenario={handleSelectScenario}
      />

      {/* 10. Global Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={removeToast} />

    </div>
  );
}
