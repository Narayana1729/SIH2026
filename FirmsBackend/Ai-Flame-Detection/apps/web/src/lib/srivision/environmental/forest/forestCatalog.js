/**
 * @module environmental/forest/forestCatalog
 * @description Curated baseline catalog of globally significant forest and biodiversity conservation zones.
 */

export const MONITORED_FOREST_HOTSPOTS = Object.freeze([
  {
    id: 'amazon-rondonia',
    name: 'Rondônia Frontier Arc',
    region: 'Amazon Basin',
    country: 'Brazil',
    coordinates: [-62.8, -10.2],
    bbox: [-63.5, -11.0, -62.0, -9.5],
    biome: 'Tropical Moist Broadleaf',
    threat_profile: 'Agricultural frontier expansion and cattle ranching',
    latest_metrics: {
      forest_loss_percent: 6.8,
      canopy_cover_percent: 68.2,
      active_fire_count: 14,
      risk_level: 'HIGH',
    },
    timeline: [
      { year: 2021, canopyCover: 78.4, lossRate: 1.8 },
      { year: 2022, canopyCover: 75.1, lossRate: 3.3 },
      { year: 2023, canopyCover: 71.5, lossRate: 3.6 },
      { year: 2024, canopyCover: 68.2, lossRate: 3.3 },
    ],
  },
  {
    id: 'congo-salonga',
    name: 'Salonga National Park Corridor',
    region: 'Congo Basin',
    country: 'DR Congo',
    coordinates: [21.5, -2.1],
    bbox: [20.8, -2.8, 22.2, -1.4],
    biome: 'Dense Equatorial Rainforest',
    threat_profile: 'Smallholder clearing and artisanal logging',
    latest_metrics: {
      forest_loss_percent: 2.1,
      canopy_cover_percent: 88.5,
      active_fire_count: 3,
      risk_level: 'LOW',
    },
    timeline: [
      { year: 2021, canopyCover: 91.2, lossRate: 0.8 },
      { year: 2022, canopyCover: 90.4, lossRate: 0.8 },
      { year: 2023, canopyCover: 89.5, lossRate: 0.9 },
      { year: 2024, canopyCover: 88.5, lossRate: 1.0 },
    ],
  },
  {
    id: 'borneo-kalimantan',
    name: 'Central Kalimantan Peat Swamp',
    region: 'Sundaland',
    country: 'Indonesia',
    coordinates: [113.8, -2.5],
    bbox: [113.0, -3.2, 114.5, -1.8],
    biome: 'Tropical Peat Swamp Forest',
    threat_profile: 'Peatland drainage and plantation concessions',
    latest_metrics: {
      forest_loss_percent: 5.4,
      canopy_cover_percent: 62.0,
      active_fire_count: 8,
      risk_level: 'HIGH',
    },
    timeline: [
      { year: 2021, canopyCover: 72.0, lossRate: 2.9 },
      { year: 2022, canopyCover: 68.5, lossRate: 3.5 },
      { year: 2023, canopyCover: 65.1, lossRate: 3.4 },
      { year: 2024, canopyCover: 62.0, lossRate: 3.1 },
    ],
  },
  {
    id: 'western-ghats',
    name: 'Silent Valley & Nilgiri Biosphere',
    region: 'Western Ghats',
    country: 'India',
    coordinates: [76.5, 11.1],
    bbox: [76.0, 10.6, 77.0, 11.6],
    biome: 'Tropical Montane Evergreen',
    threat_profile: 'Linear infrastructure and invasive species',
    latest_metrics: {
      forest_loss_percent: 1.2,
      canopy_cover_percent: 84.2,
      active_fire_count: 1,
      risk_level: 'LOW',
    },
    timeline: [
      { year: 2021, canopyCover: 86.0, lossRate: 0.5 },
      { year: 2022, canopyCover: 85.3, lossRate: 0.7 },
      { year: 2023, canopyCover: 84.8, lossRate: 0.5 },
      { year: 2024, canopyCover: 84.2, lossRate: 0.6 },
    ],
  },
]);

export function getAllMonitoredHotspots() {
  return MONITORED_FOREST_HOTSPOTS;
}

export function getHotspotById(id) {
  return MONITORED_FOREST_HOTSPOTS.find((h) => h.id === id) || null;
}
