/**
 * Types for Satellite Orbital Revisit Forecasting, Scan Geometry,
 * and Blind-Window Dead-Reckoning Intelligence.
 */

export type SatellitePlatform = 
  | 'VIIRS_NOAA20' 
  | 'VIIRS_NOAA21' 
  | 'VIIRS_SNPP' 
  | 'MODIS_TERRA' 
  | 'MODIS_AQUA'
  | 'INSAT_3DR_GEO';

export interface SatelliteOrbitPass {
  platform: SatellitePlatform;
  instrument: string; // e.g. "VIIRS (375m)" or "MODIS (1km)" or "INSAT-3DR Imager (4km)"
  estimatedPassTimeIso: string;
  minutesUntilPass: number;
  orbitType: 'LEO_POLAR' | 'GEO_STATIONARY';
  sensorResolutionNadirM: number;
  expectedResolutionScanEdgeM: number;
  viewingGeometry: 'APPROACHING_NADIR' | 'OFF_NADIR_LIMB' | 'RAPID_HEMISPHERIC';
}

export interface SensorScanFootprint {
  scanAngleDeg: number; // e.g. 0° (nadir) to 56° (swath edge)
  pixelWidthScanMeters: number; // e.g. 375m at nadir to ~800m at edge
  pixelLengthTrackMeters: number; // e.g. 375m to ~800m
  footprintAreaM2: number;
  distortionFactor: number; // e.g. 1.0 at nadir up to 4.5x at edge
  isEdgeOfSwathDistorted: boolean;
  viewingParallaxShiftEstimateMeters: number;
}

export interface SatelliteRevisitForecast {
  eventId: string;
  lastObservationTimeIso: string;
  elapsedMinutesSinceObservation: number;
  nextLeoPass: SatelliteOrbitPass;
  upcomingPasses: SatelliteOrbitPass[];
  geostationaryCadenceMinutes: number; // 15 mins for INSAT-3DR
  insatNextScanMinutes: number;
  isBlindWindowActive: boolean; // True when > 45 mins since last pass
  blindWindowDurationRemainingMinutes: number;
  blindWindowGuidance: string;
  sensorFootprint: SensorScanFootprint;
}
