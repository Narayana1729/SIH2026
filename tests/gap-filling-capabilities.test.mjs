import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Protected Areas Service
import { evaluateProtectedAreaThreat, getAllProtectedAreas } from '../src/services/protectedAreasService.js';

// 2. Incident Simulation Lab
import { runWhatIfSimulation, SCENARIOS } from '../src/simulation/incidentSimulationLab.js';

// 3. Spatiotemporal Clustering
import { clusterFirmsDBSCAN, computeConvexHullMonotoneChain, computePolygonAreaKm2 } from '../src/analytics/spatiotemporalClustering.js';

// 4. CAMEO HazMat Registry
import { cameoHazmatRegistry } from '../src/hazmat/cameoHazmatRegistry.js';

// 5. Critical Infrastructure Registry
import { infrastructureRegistry } from '../src/gis/infrastructureRegistry.js';

// 6. PDF IAP Generator
import { generateIncidentActionPlanPdf } from '../server/services/pdfIapGenerator.mjs';

test('Capability 1: Protected Areas Threat Intelligence & Point-to-Polygon Geodesic Distance', async (t) => {
  await t.test('loads authoritative Indian protected areas catalog', () => {
    const areas = getAllProtectedAreas();
    assert.ok(Array.isArray(areas));
    assert.ok(areas.length >= 10, `Expected at least 10 sanctuaries, found ${areas.length}`);

    const corbett = areas.find(a => a.name.includes('Corbett'));
    assert.ok(corbett, 'Jim Corbett National Park must exist in catalog');
    assert.equal(corbett.state, 'Uttarakhand');
    assert.ok(Array.isArray(corbett.coordinates) && corbett.coordinates[0].length >= 4);
  });

  await t.test('detects point directly INSIDE a National Park polygon as CRITICAL (0.0 km)', () => {
    // Centroid of Jim Corbett National Park: [78.92, 29.58]
    const result = evaluateProtectedAreaThreat(29.58, 78.92);
    assert.equal(result.inside, true);
    assert.equal(result.distanceKm, 0.0);
    assert.equal(result.threatLevel, 'CRITICAL');
    assert.ok(result.nearest.name.includes('Corbett'));
  });

  await t.test('evaluates proximity risk bands: WARNING (<=5km), ADVISORY (<=10km), NOMINAL (>10km)', () => {
    // Far from any sanctuary (>100km away)
    const resultNominal = evaluateProtectedAreaThreat(25.0, 72.0);
    assert.equal(resultNominal.inside, false);
    assert.ok(resultNominal.distanceKm > 10.0);
    assert.equal(resultNominal.threatLevel, 'NOMINAL');

    // Point near Bandipur National Park perimeter (~11.60°N, 76.45°E)
    const resultClose = evaluateProtectedAreaThreat(11.61, 76.46);
    assert.ok(resultClose.distanceKm <= 5.0);
    assert.ok(['CRITICAL', 'WARNING'].includes(resultClose.threatLevel));
  });
});

test('Capability 2: Interactive What-If Incident Simulation Lab', async (t) => {
  await t.test('runs deterministic baseline simulation with physics coupling', () => {
    const sim = runWhatIfSimulation({
      latitude: 22.3,
      longitude: 73.2,
      windSpeedMps: 5.5,
      windDirectionDeg: 90,
      frpMw: 35,
      scenarioMode: 'BASELINE',
    });

    assert.equal(sim.epistemic_classification, 'SIMULATED SCENARIO');
    assert.equal(sim.scenario_metadata.scenario_id, 'BASELINE');
    assert.ok(sim.projected_outputs.downwind_hazard_distance_km > 0);
    assert.ok(sim.projected_outputs.total_affected_area_km2 > 0);
    assert.ok(sim.fire_spread.perimeters.length > 0);
    assert.ok(sim.projected_outputs.evacuation_recommendation_m >= 500);
  });

  await t.test('secondary explosion scenario dramatically amplifies heat release and blast zone', () => {
    const baselineSim = runWhatIfSimulation({
      latitude: 22.3,
      longitude: 73.2,
      windSpeedMps: 4.0,
      windDirectionDeg: 90,
      frpMw: 35,
      scenarioMode: 'BASELINE',
    });

    const explosionSim = runWhatIfSimulation({
      latitude: 22.3,
      longitude: 73.2,
      windSpeedMps: 4.0,
      windDirectionDeg: 90,
      frpMw: 35,
      scenarioMode: 'SECONDARY_EXPLOSION',
    });

    assert.ok(explosionSim.inputs.effective_frp_mw > baselineSim.inputs.effective_frp_mw * 2.5);
    assert.ok(explosionSim.projected_outputs.evacuation_recommendation_m > baselineSim.projected_outputs.evacuation_recommendation_m);
    assert.equal(explosionSim.scenario_metadata.blast_radius_meters, 1000);
  });

  await t.test('dry fuel gust scenario accelerates fire rate of spread and downwind distance', () => {
    const gustSim = runWhatIfSimulation({
      latitude: 22.3,
      longitude: 73.2,
      windSpeedMps: 12.5,
      windDirectionDeg: 180,
      frpMw: 35,
      scenarioMode: 'DRY_FUEL_GUST',
    });

    assert.equal(gustSim.inputs.wind_speed_kmh, 45.0);
    assert.ok(gustSim.projected_outputs.downwind_hazard_distance_km >= 2.0);
  });
});

test('Capability 3: Spatiotemporal Fire-Event Clustering & Convex Hull Perimeters', async (t) => {
  const testFirmsPoints = [
    { latitude: 21.000, longitude: 85.000, frp: 20.0, acq_date: '2026-09-18', acq_time: '0400', confidence: 95 },
    { latitude: 21.005, longitude: 85.005, frp: 35.0, acq_date: '2026-09-18', acq_time: '0430', confidence: 90 },
    { latitude: 21.008, longitude: 85.002, frp: 45.0, acq_date: '2026-09-18', acq_time: '0500', confidence: 88 },
    { latitude: 21.002, longitude: 85.010, frp: 15.0, acq_date: '2026-09-18', acq_time: '0530', confidence: 92 },
    // Isolated point 80km away
    { latitude: 21.800, longitude: 85.800, frp: 12.0, acq_date: '2026-09-18', acq_time: '0600', confidence: 80 },
  ];

  await t.test('clusters nearby points into an event entity and computes trajectory and perimeter', () => {
    const events = clusterFirmsDBSCAN(testFirmsPoints, { spatialRadiusKm: 2.0, temporalWindowHours: 72 });
    assert.ok(Array.isArray(events));
    assert.ok(events.length >= 1, 'Should produce at least 1 cluster event');

    const topEvent = events[0];
    assert.ok(topEvent.event_id.startsWith('EVT-'));
    assert.equal(topEvent.observation_count, 4);
    assert.equal(topEvent.intensity.max_frp_mw, 45.0);
    assert.ok(topEvent.intensity.sum_frp_mw >= 115.0);
    assert.ok(topEvent.centroid.latitude > 20.99 && topEvent.centroid.latitude < 21.02);
    assert.ok(topEvent.current_perimeter.coordinates[0].length >= 4);
    assert.ok(topEvent.current_perimeter.area_km2 > 0);
    assert.ok(topEvent.trajectory.displacement_km >= 0);
  });

  await t.test('computes valid 2D convex hull via Monotone Chain and polygon area', () => {
    const coords = [
      [85.000, 21.000],
      [85.010, 21.000],
      [85.010, 21.010],
      [85.000, 21.010],
      [85.005, 21.005], // Interior point
    ];
    const hull = computeConvexHullMonotoneChain(coords);
    assert.equal(hull.length, 5, 'Closed convex hull should omit interior point and have 5 coordinates (4 vertices + close)');

    const area = computePolygonAreaKm2(hull);
    assert.ok(area > 0.5 && area < 2.0, `Polygon area should be ~1.2 km^2, got ${area}`);
  });
});

test('Capability 4: Expanded Hazardous-Material Intelligence (CAMEO / NIOSH)', async (t) => {
  await t.test('loads authoritative CAMEO-NIOSH industrial chemicals catalog', () => {
    const catalog = cameoHazmatRegistry.chemicals;
    assert.ok(Array.isArray(catalog));
    assert.ok(catalog.length >= 10);
  });

  await t.test('searches by chemical name, UN placard, and CAS number', () => {
    // Search by UN number
    const un1005 = cameoHazmatRegistry.search('UN1005');
    assert.ok(un1005.length > 0);
    assert.equal(un1005[0].chemical_id, 'chem_ammonia_anhydrous');

    // Search by CAS number
    const chlorine = cameoHazmatRegistry.search('7782-50-5');
    assert.ok(chlorine.length > 0);
    assert.equal(chlorine[0].chemical_id, 'chem_chlorine');

    // Search by chemical name
    const benzene = cameoHazmatRegistry.search('Benzene');
    assert.ok(benzene.length > 0);
    assert.equal(benzene[0].chemical_id, 'chem_benzene');
    assert.equal(benzene[0].nfpa_704.flammability, 3);
  });

  await t.test('validates emergency response limits (AEGL, ERPG, IDLH, and ERG isolation distances)', () => {
    const h2s = cameoHazmatRegistry.getChemical('chem_hydrogen_sulfide');
    assert.ok(h2s);
    assert.equal(h2s.idlh_ppm, 100);
    assert.equal(h2s.aegl_1hr_ppm.aegl_3, 50);
    assert.equal(h2s.initial_isolation_m, 1500);
    assert.equal(h2s.downwind_evac_night_m, 4500);
  });

  await t.test('resolves sector chemicals for industrial facilities', () => {
    const refineryChems = cameoHazmatRegistry.getChemicalsForSector('Petrochemical & Polymer Complex');
    assert.ok(refineryChems.length >= 2);
    const ids = refineryChems.map(c => c.chemical_id);
    assert.ok(ids.includes('chem_benzene') || ids.includes('chem_ammonia_anhydrous') || ids.includes('chem_styrene'));
  });
});

test('Capability 5: Critical-Infrastructure GIS Intelligence (Pipelines, Transmission, Mining)', async (t) => {
  await t.test('verifies loaded infrastructure layers and schema', () => {
    const layers = infrastructureRegistry.getAllLayers();
    assert.ok(layers.length >= 4);

    const pipelines = layers.find(l => l.id === 'gas_pipelines');
    assert.ok(pipelines, 'Gas Pipelines layer must exist');
    assert.equal(pipelines.feature_count, 5);

    const powergrid = layers.find(l => l.id === 'transmission_lines');
    assert.ok(powergrid, 'Transmission layer must exist');
    assert.equal(powergrid.feature_count, 4);

    const coal = layers.find(l => l.id === 'mining_basins');
    assert.ok(coal, 'Mining Basins layer must exist');
    assert.equal(coal.feature_count, 3);
  });

  await t.test('detects proximity to GAIL HVJ / Dahej-Vijaipur pipeline corridor', () => {
    // Coordinate along Gujarat Dahej / Vijaipur corridor (~21.7°N, 73.0°E)
    const result = infrastructureRegistry.findIntersectingInfrastructure(21.7, 73.0, 50.0);
    assert.ok(result.infrastructure.length > 0);

    const hit = result.infrastructure[0];
    assert.ok(hit.distance_km <= 50.0);
    assert.ok(hit.layer_id);
    assert.ok(hit.asset_name);
  });

  await t.test('detects proximity to Jharia / Dhanbad Coal Basin', () => {
    // Coordinate in Jharia basin (~23.75°N, 86.42°E)
    const result = infrastructureRegistry.findIntersectingInfrastructure(23.75, 86.42, 20.0);
    assert.ok(result.infrastructure.length > 0);

    const jharia = result.infrastructure.find(h => h.asset_name.includes('Jharia'));
    assert.ok(jharia, 'Must detect Jharia Coal Basin proximity');
    assert.ok(jharia.distance_km <= 10.0);
  });
});

test('Capability 6: Official Incident Action Plan (IAP) 6-Page PDF Generation', async (t) => {
  const sampleHazard = {
    id: 'test-iap-001',
    title: 'Jamnagar Petrochemical Thermal Surge',
    subtitle: 'Petrochemical / Refinery · Cracker Furnace',
    severity: 'CRITICAL',
    data_classification: 'REAL_LIVE',
    latitude: 22.47,
    longitude: 70.06,
    frp: 85.4,
    bright_ti4: 382.5,
    satellite: 'VIIRS Suomi-NPP',
    facility: {
      name: 'Jamnagar Refining Complex',
      category: 'Petrochemical / Refinery',
      capacity_mw: 1200,
      state: 'Gujarat',
    },
    actions: [
      'Establish 800m exclusion boundary.',
      'Deploy industrial foam tender units.',
      'Notify regional disaster management authority.',
    ],
  };

  const sampleWeather = {
    windSpeedKmh: 28.5,
    windDirectionDegrees: 240,
    temperatureC: 34.2,
    humidityPercent: 42,
  };

  const sampleDozier = {
    flameTempK: 1145,
    flameTempC: 872,
    flameAreaM2: 260,
    radiantHeatFluxKwM2: 97.4,
    regime: 'Industrial Process / Gas Flare',
  };

  const sampleHazmat = {
    cameo_hazmat_class: 'Class 3 / Class 2.1',
    un_na_numbers: ['UN 1267', 'UN 1075', 'UN 1114'],
    primary_chemicals: ['Crude Hydrocarbons', 'Liquefied Petroleum Gas', 'Benzene'],
    primary_disaster_risk: 'BLEVE / Vapor Cloud Explosion / Toxic Inhalation',
    initial_isolation_distance_meters: 800,
    downwind_evacuation_day_meters: 1600,
    downwind_evacuation_night_meters: 2400,
    firefighting_protocol: 'Deploy AFFF alcohol-resistant foam and deluge water curtains.',
    toxic_combustion_byproducts: ['CO', 'SO2', 'VOCs', 'Hydrogen Sulfide'],
  };

  const sampleSimulation = {
    is_simulated: true,
    epistemic_classification: 'SIMULATED SCENARIO',
    scenario_details: { code: 'SECONDARY_EXPLOSION', name: 'Secondary Hydrocarbon Explosion' },
    effective_frp_mw: 256.2,
    plume_geometry: { downwind_distance_km: 4.8, effective_plume_height_m: 380 },
    fire_spread: { forward_rate_of_spread_m_hr: 185, projected_perimeter_km: 3.2 },
    evacuation_zones: { initial_isolation_zone_m: 1600, protective_action_distance_m: 3200 },
  };

  const pdfBuffer = await generateIncidentActionPlanPdf({
    hazard: sampleHazard,
    weather: sampleWeather,
    dozier: sampleDozier,
    hazmat: sampleHazmat,
    simulation: sampleSimulation,
  });

  assert.ok(Buffer.isBuffer(pdfBuffer), 'Output must be a binary Node.js Buffer');
  assert.ok(pdfBuffer.length > 8000, `PDF length should be substantial (>8KB), got ${pdfBuffer.length} bytes`);

  // Verify PDF binary header
  const header = pdfBuffer.subarray(0, 5).toString('ascii');
  assert.equal(header, '%PDF-', 'Must start with valid PDF magic bytes');

  // Verify 6-page layout
  const pdfString = pdfBuffer.toString('latin1');
  const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g) || [];
  assert.equal(pageMatches.length, 6, `PDF must have exactly 6 pages, found ${pageMatches.length}`);

  // Verify metadata and title
  assert.ok(pdfString.includes('Incident Action Plan') || pdfString.includes('/Title'));

  // Decode hex text tokens from PDF stream to verify epistemic badges
  const hexChunks = (pdfString.match(/<([0-9a-fA-F]+)>/g) || []).map(h => {
    return Buffer.from(h.slice(1, -1), 'hex').toString('latin1');
  }).join('');

  assert.ok(hexChunks.includes('OBSERVED') && hexChunks.includes('CALCULATED') && hexChunks.includes('SIMULATED'), 'PDF must include [OBSERVED], [CALCULATED], and [SIMULATED] epistemic sections');
});
