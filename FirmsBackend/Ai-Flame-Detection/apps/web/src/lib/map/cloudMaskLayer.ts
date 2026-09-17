/**
 * Sensor Visibility & Meteorological Cloud Opacity Mask Engine.
 * 
 * Maps unobservable geographic zones where high-altitude cloud cover,
 * marine stratus, or orographic condensation completely attenuates
 * 3.74μm MWIR and 11.45μm LWIR radiance. Prevents the critical operational
 * fallacy of assuming "no satellite detection = no wildfire/flare".
 */

export interface CloudBlindZoneFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    zoneId: string;
    label: string;
    cloudOpacity: number; // 0.0 to 1.0
    mwirPenetrationPercent: number; // typically 0 - 15%
    thermalStatus: "BLIND_ZONE" | "PARTIALLY_ATTENUATED";
    altitudeMslM: number;
    recommendedAction: string;
  };
}

export interface CloudMaskFeatureCollection {
  type: "FeatureCollection";
  features: CloudBlindZoneFeature[];
  metadata: {
    generatedAt: string;
    totalObscuredAreaKm2: number;
    sensorPenetrationModel: string;
  };
}

/**
 * Generates the canonical meteorological cloud opacity & sensor blind-spot GeoJSON.
 */
export function generateCloudMaskGeoJson(): CloudMaskFeatureCollection {
  const features: CloudBlindZoneFeature[] = [
    // 1. Himalayan Foothills & Sub-Himalayan Orographic Cloud Bank (Uttarakhand / Himachal)
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2, 30.1],
            [79.8, 29.2],
            [81.2, 28.9],
            [81.5, 30.2],
            [79.5, 31.1],
            [77.8, 31.4],
            [77.2, 30.1],
          ],
        ],
      },
      properties: {
        zoneId: "CLOUD-REG-HIMALAYA-01",
        label: "Himalayan Orographic Cloud Veil (Uttarakhand-Nepal)",
        cloudOpacity: 0.92,
        mwirPenetrationPercent: 4,
        thermalStatus: "BLIND_ZONE",
        altitudeMslM: 4200,
        recommendedAction:
          "Zero VIIRS MWIR thermal penetration. Utilize INSAT-3DR geostationary 15-min sounder infill and Forest Department drone patrols.",
      },
    },

    // 2. Coastal Bay of Bengal Marine Inversion & Depression (Odisha-Andhra Coast)
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [84.5, 18.2],
            [87.1, 19.8],
            [87.8, 21.2],
            [86.2, 21.5],
            [84.1, 19.4],
            [84.5, 18.2],
          ],
        ],
      },
      properties: {
        zoneId: "CLOUD-REG-BAY-02",
        label: "Bay of Bengal Coastal Stratus & Attenuation Belt",
        cloudOpacity: 0.78,
        mwirPenetrationPercent: 12,
        thermalStatus: "PARTIALLY_ATTENUATED",
        altitudeMslM: 1800,
        recommendedAction:
          "High signal attenuation. Minor industrial flares (<15 MW) may escape LEO detection. Cross-reference coastal radar.",
      },
    },

    // 3. Northeast Hills & Brahmaputra Valley Monsoon Trough (Assam-Meghalaya)
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [91.0, 25.1],
            [93.8, 25.4],
            [95.2, 26.8],
            [94.1, 27.5],
            [91.5, 26.6],
            [91.0, 25.1],
          ],
        ],
      },
      properties: {
        zoneId: "CLOUD-REG-NE-03",
        label: "Brahmaputra Valley Cumulonimbus Veil (Assam / Meghalaya)",
        cloudOpacity: 0.95,
        mwirPenetrationPercent: 2,
        thermalStatus: "BLIND_ZONE",
        altitudeMslM: 3500,
        recommendedAction:
          "Dense convective cloud bank. All satellite thermal sensors blinded. Field SEOC alert dispatched.",
      },
    },

    // 4. Western Ghats Orographic Cloud Ridge (Kerala-Karnataka Escarpment)
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [75.1, 12.2],
            [76.0, 11.4],
            [77.1, 9.8],
            [76.2, 9.5],
            [74.8, 11.8],
            [75.1, 12.2],
          ],
        ],
      },
      properties: {
        zoneId: "CLOUD-REG-WG-04",
        label: "Western Ghats High-Elevation Cloud Condensation Escarpment",
        cloudOpacity: 0.88,
        mwirPenetrationPercent: 6,
        thermalStatus: "BLIND_ZONE",
        altitudeMslM: 2200,
        recommendedAction:
          "Elevated cloud blanket masking canopy level thermal signals. Ground watchtowers activated.",
      },
    },
  ];

  return {
    type: "FeatureCollection",
    features,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalObscuredAreaKm2: 148500,
      sensorPenetrationModel: "MODTRAN Radiative Transfer / VIIRS Cloud Mask Intermediate Product (VNP35)",
    },
  };
}
