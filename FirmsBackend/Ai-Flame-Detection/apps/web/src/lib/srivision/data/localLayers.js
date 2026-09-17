import { createLocalGeoJsonLayer } from './localGeojson.js';
import { createFirmsHeatmapLayer } from './firmsHeatmap.js';

// Use Vite's ?url import to properly resolve these assets in dev and build
import damsUrl from './local_data/dams/dams.geojsonl?url';
import industrialUrl from './local_data/industrial/industrial.geojsonl?url';

/**
 * Registry of local GeoJSON datasets for Environmental & Disaster monitoring.
 */
const dams = createLocalGeoJsonLayer({
  id: 'local-dams',
  url: damsUrl,
  name: 'Dams & Reservoirs',
  color: '#0088ff', // Blue
  icon: '▰',
  source: 'USACE / Global Dams',
  labels: true,
  labelMax: 900,
  labelGridPx: 132,
});

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

// Live NASA FIRMS fires (VIIRS ×3 NRT via the /api/firms proxy).
const fires = createFirmsHeatmapLayer({
  id: 'local-firms',
  name: 'FIRMS Active Fires',
  icon: '▲',
  source: 'NASA FIRMS · LIVE',
});

export default [
  dams,
  industrial,
  fires,
];

