/**
 * @module src/firms/domain/constants
 * @description Domain constants and schema definitions for SIH Industrial Thermal Anomaly System.
 */

/**
 * Primary classification: Hard segregation of Industrial vs Non-Industrial thermal events.
 */
export const PrimaryClassification = Object.freeze({
  INDUSTRIAL: 'INDUSTRIAL',
  NON_INDUSTRIAL: 'NON_INDUSTRIAL',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Secondary subtypes for Industrial thermal anomalies.
 */
export const IndustrialSubtype = Object.freeze({
  INDUSTRIAL_FIRE: 'INDUSTRIAL_FIRE',                     // Accidental fire, explosion, or catastrophic thermal surge
  GAS_FLARE: 'GAS_FLARE',                                 // Controlled hydrocarbon flare stack
  PROCESS_HEAT_SOURCE: 'PROCESS_HEAT_SOURCE',             // Normal blast furnace, kiln, boiler, or process emission
  INDUSTRIAL_THERMAL_SOURCE: 'INDUSTRIAL_THERMAL_SOURCE', // General verified persistent industrial heat signature
  MINING_THERMAL_ACTIVITY: 'MINING_THERMAL_ACTIVITY',     // Open-cast coal seam fires, slag dumps, metallurgical processing
  OTHER_INDUSTRIAL: 'OTHER_INDUSTRIAL',                   // Unspecified industrial zone thermal anomaly
});

/**
 * Secondary subtypes for Non-Industrial thermal anomalies.
 */
export const NonIndustrialSubtype = Object.freeze({
  WILDFIRE: 'WILDFIRE',                                   // Forest, woodland, or bush fire
  AGRICULTURAL_BURNING: 'AGRICULTURAL_BURNING',           // Crop residue / stubble burning in farmland
  VEGETATION_FIRE: 'VEGETATION_FIRE',                     // Grassland, scrubland, or brush fire
  NATURAL_THERMAL_ANOMALY: 'NATURAL_THERMAL_ANOMALY',     // Geothermal vents, hot springs, volcanic
  OTHER_NON_INDUSTRIAL: 'OTHER_NON_INDUSTRIAL',           // Unspecified rural/natural thermal event
});

/**
 * Industrial Facility Infrastructure Categories.
 */
export const FacilityType = Object.freeze({
  OIL_REFINERY: 'OIL_REFINERY',
  PETROCHEMICAL_COMPLEX: 'PETROCHEMICAL_COMPLEX',
  THERMAL_POWER_PLANT: 'THERMAL_POWER_PLANT',
  STEEL_PLANT: 'STEEL_PLANT',
  MINING_SITE: 'MINING_SITE',
  LNG_TERMINAL: 'LNG_TERMINAL',
  CEMENT_PLANT: 'CEMENT_PLANT',
  CHEMICAL_PLANT: 'CHEMICAL_PLANT',
  INDUSTRIAL_FACILITY: 'INDUSTRIAL_FACILITY',
  KNOWN_FLARE: 'KNOWN_FLARE',
});

/**
 * SIH Industrial Alert Types.
 */
export const AlertType = Object.freeze({
  NEW_INDUSTRIAL_FIRE: 'NEW_INDUSTRIAL_FIRE',
  PERSISTENT_INDUSTRIAL_SOURCE: 'PERSISTENT_INDUSTRIAL_SOURCE',
  ABNORMAL_THERMAL_ACTIVITY: 'ABNORMAL_THERMAL_ACTIVITY',
  HIGH_CONFIDENCE_INDUSTRIAL_EVENT: 'HIGH_CONFIDENCE_INDUSTRIAL_EVENT',
  SIGNIFICANT_THERMAL_ANOMALY: 'SIGNIFICANT_THERMAL_ANOMALY',
});

/**
 * Risk Levels.
 */
export const RiskLevel = Object.freeze({
  NOMINAL: 'NOMINAL',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});
