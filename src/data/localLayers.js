import { createLocalGeoJsonLayer } from './localGeojson.js';
import { createFirmsHeatmapLayer } from './firmsHeatmap.js';

// Use Vite's ?url import to properly resolve these assets in dev and build
import industrialUrl from './local_data/industrial/industrial.geojsonl?url';
import thermalSourcesUrl from './local_data/industrial/thermal_sources.geojsonl?url';
import fireStationsUrl from './local_data/responders/fire_stations.geojsonl?url';
import hospitalsUrl from './local_data/responders/hospitals.geojsonl?url';

/**
 * Registry of local GeoJSON datasets for Industrial & Thermal monitoring.
 */

// 1. Live NASA FIRMS fires (VIIRS ×3 NRT via the /api/firms proxy).
const fires = createFirmsHeatmapLayer({
  id: 'local-firms',
  name: 'FIRMS Live API Telemetry',
  icon: '🛰️',
  source: 'NASA FIRMS · Live Key Proxy',
  mode: 'live',
});

// 2. Stored Historical Data (124,000+ Detections / 1,333 Days Archive)
const storedFires = createFirmsHeatmapLayer({
  id: 'local-stored-firms',
  name: 'Data Stored (Historical Archive)',
  icon: '🗄️',
  source: 'NASA Archive (124k+ Records / 1,333 Passes)',
  mode: 'stored',
});

// 2. Industrial & HazMat Infrastructure
const industrial = createLocalGeoJsonLayer({
  id: 'local-industrial',
  url: industrialUrl,
  name: 'Industrial & HazMat Facilities',
  color: '#ff9900', // Amber / Orange
  icon: '🏭',
  source: 'CPCB / MoEFCC / Power Database',
  labels: true,
  labelMax: 900,
  labelGridPx: 120,
});

// 3. Persistent Operational Thermal Sources & Baselines
const thermalSources = createLocalGeoJsonLayer({
  id: 'local-thermal-sources',
  url: thermalSourcesUrl,
  name: 'Persistent Thermal Sources',
  color: '#ffd600', // Gold / Yellow
  icon: '♨️',
  source: 'PyroSat Persistence Engine (350+ Sources)',
  labels: true,
  labelMax: 900,
  labelGridPx: 120,
});

// 4. Fire Stations, Refinery Units & NDRF Battalions
const fireStations = createLocalGeoJsonLayer({
  id: 'local-fire-stations',
  url: fireStationsUrl,
  name: 'Fire Stations & NDRF Brigades',
  color: '#ff1744', // Vivid Red
  icon: '🚒',
  source: 'National Fire Services & NDRF Grid (71 Units)',
  labels: true,
  labelMax: 900,
  labelGridPx: 120,
});

// 5. Apex Burn Care & Chemical Poisoning Trauma Hospitals
const hospitals = createLocalGeoJsonLayer({
  id: 'local-hospitals',
  url: hospitalsUrl,
  name: 'Burn ICUs & Trauma Centers',
  color: '#00e676', // Emerald Green
  icon: '🏥',
  source: 'National Health Trauma Grid (56 Apex Centers)',
  labels: true,
  labelMax: 900,
  labelGridPx: 120,
});

export default [
  fires,
  storedFires,
  industrial,
  thermalSources,
  fireStations,
  hospitals,
];


