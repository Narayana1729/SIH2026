/**
 * @file tests/disaster-extensions.test.mjs
 * @description Unit and Integration tests for Industrial HazMat GIS, Responders, Gaussian Plume, Fire Spread ROS, and Tactical Dossier.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getAllFacilities, findFacilitiesNearby, getHazmatProfiles } from '../src/disasters/industrial/industrialFacilities.js';
import { findCategorizedRespondersNearby } from '../src/disasters/responders/emergencyResponders.js';
import { estimateStabilityClass, calculateGroundConcentration, generatePlumeFootprint } from '../src/disasters/dispersion/gaussianPlume.js';
import { computeSlopeFactor, computeWindFactor, calculateRateOfSpread, simulateFirePerimeters } from '../src/disasters/wildfire/fireSpreadSimulation.js';
import { generateIncidentDossier } from '../src/intelligence/dossierGenerator.js';

test('Industrial GIS: loads master facilities and queries nearby plants with HazMat profiles', () => {
  const all = getAllFacilities();
  assert.ok(Array.isArray(all) && all.length > 0, 'Must load facilities array');

  // Query near Jamnagar (lat ~22.47, lon ~70.05)
  const nearby = findFacilitiesNearby(22.47, 70.05, 50);
  assert.ok(nearby.length > 0, 'Should find industrial plants near Jamnagar');
  assert.ok(nearby[0].distance_km <= 50, 'Distance must be <= 50km');
  assert.ok(nearby[0].name, 'Facility must have name');

  const profiles = getHazmatProfiles();
  assert.ok(profiles['Oil Refinery'], 'Hazmat profiles must include Oil Refinery');
  assert.ok(profiles['Oil Refinery'].initial_isolation_distance_meters > 0);
});

test('Emergency Responders: categorizes nearest fire stations, NDRF battalions, and hospitals', () => {
  // Query near Delhi (lat ~28.61, lon ~77.20)
  const categorized = findCategorizedRespondersNearby(28.61, 77.20, 200);
  assert.ok(Array.isArray(categorized.hospitals), 'Must have hospitals array');
  assert.ok(categorized.all.length > 0, 'Must return nearby responders');
});

test('Gaussian Plume: computes stability class, ground concentration, and polygon footprint', () => {
  const stability = estimateStabilityClass(4.5, true, 'strong');
  assert.equal(stability, 'B', '4.5 m/s in daytime strong sun is Class B');

  const conc = calculateGroundConcentration({
    emissionRateGps: 500,
    windSpeedMps: 5,
    effectiveHeightMeters: 10,
    downwindXMeters: 1000,
    crosswindYMeters: 0,
    stabilityClass: 'D',
  });
  assert.ok(conc > 0, 'Downwind ground concentration must be positive');

  const footprint = generatePlumeFootprint({
    sourceLat: 22.47,
    sourceLon: 70.05,
    windDirectionDeg: 270,
    windSpeedMps: 6,
    maxDistanceKm: 10,
  });

  assert.equal(footprint.model_type, 'GAUSSIAN_ATMOSPHERIC_PLUME');
  assert.equal(footprint.plume_heading_deg, 90, 'Wind from 270 means plume heads East (90 deg)');
  assert.equal(footprint.polygon_geojson.type, 'Feature');
  assert.ok(footprint.polygon_geojson.geometry.coordinates[0].length > 10);
});

test('Wildfire Simulation: computes Rothermel ROS and generates progressive elliptical perimeters', () => {
  const windFactor = computeWindFactor(36); // 10 m/s
  const slopeFactor = computeSlopeFactor(15);
  assert.ok(windFactor > 0);
  assert.ok(slopeFactor > 0);

  const ros = calculateRateOfSpread({
    fuelCategory: 'DENSE_FOREST',
    windSpeedKmh: 30,
    slopeDegrees: 10,
    relativeHumidity: 20,
  });
  assert.ok(ros.head_ros_m_per_min > ros.flank_ros_m_per_min, 'Head ROS must exceed flank ROS');
  assert.ok(ros.flank_ros_m_per_min > ros.back_ros_m_per_min, 'Flank ROS must exceed backing ROS');

  const sim = simulateFirePerimeters({
    lat: 18.52,
    lon: 73.85,
    windSpeedKmh: 25,
    windDirectionDeg: 180, // Wind from South, spreads North (0 deg)
    timeHorizonsHours: [1, 2, 4],
  });

  assert.equal(sim.perimeters.length, 3, 'Must have 3 horizon perimeters');
  assert.ok(sim.perimeters[2].burned_area_hectares > sim.perimeters[0].burned_area_hectares, '4h burned area must exceed 1h area');
  assert.equal(sim.perimeters[0].polygon_geojson.type, 'Feature');
});

test('Tactical Dossier: compiles multi-source situational briefing report', () => {
  const dossier = generateIncidentDossier({
    id: 'INC-TEST-001',
    type: 'WILDFIRE_THERMAL_ANOMALY',
    latitude: 22.47,
    longitude: 70.05,
    severity: 'CRITICAL',
    frp: 350,
    weather: { windSpeedKmh: 30, windDirectionDeg: 270, relativeHumidity: 15 },
    radiusKm: 30,
  });

  assert.equal(dossier.dossier_id, 'INC-TEST-001');
  assert.ok(dossier.threat_assessment.high_hazard_facilities_count >= 0);
  assert.ok(dossier.simulation_models.smoke_plume !== null);
  assert.ok(dossier.simulation_models.rate_of_spread !== null);
  assert.ok(dossier.tactical_directives.length >= 3);
  assert.equal(dossier.provenance.source_type, 'MULTI_SOURCE_SYNTHESIS');
  assert.ok(dossier.hazmat_briefing, 'Tactical dossier must include structured HazMat briefing for industrial targets');
  assert.ok(dossier.hazmat_briefing.primary_chemicals.length > 0);
  assert.ok(dossier.hazmat_briefing.un_na_numbers.length > 0);
  assert.ok(dossier.hazmat_briefing.firefighting_protocol.length > 0);
});

test('HazMat Intelligence: resolves facility-to-chemical profiles, UN placards, and CAMEO firefighting protocols', () => {
  const refineryHazmat = getHazmatProfiles()['Oil Refinery'];
  assert.ok(refineryHazmat.un_na_numbers.includes('UN1267'));
  assert.ok(refineryHazmat.primary_chemicals.includes('Benzene'));
  assert.equal(refineryHazmat.idlh_ppm.Benzene, 500);
  assert.ok(refineryHazmat.firefighting_protocol.includes('AFFF'));

  const fertilizerHazmat = getHazmatProfiles()['Fertilizer & Chemical Complex'];
  assert.ok(fertilizerHazmat.un_na_numbers.includes('UN1005'));
  assert.equal(fertilizerHazmat.idlh_ppm.Ammonia, 300);
  assert.ok(fertilizerHazmat.firefighting_protocol.includes('unmanned'));

  const chlorHazmat = getHazmatProfiles()['Chlor-Alkali & Basic Chemicals'];
  assert.ok(chlorHazmat.un_na_numbers.includes('UN1017'));
  assert.equal(chlorHazmat.idlh_ppm.Chlorine, 10);
  assert.ok(chlorHazmat.firefighting_protocol.toLowerCase().includes('water spray'));

  const steelHazmat = getHazmatProfiles()['Iron, Steel & Smelting Works'];
  assert.ok(steelHazmat.firefighting_protocol.includes('NEVER APPLY WATER TO MOLTEN LIQUID METAL'));
  assert.equal(steelHazmat.idlh_ppm.CO, 1200);
});

