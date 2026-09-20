import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const MGRS_STUB_URL = 'gev-test-stub:mgrs';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'mgrs') {
      return { url: MGRS_STUB_URL, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === MGRS_STUB_URL) {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export function forward() { return "10SEG"; }\nexport default { forward };\n',
      };
    }
    return next(url, context);
  },
});

const { IntelHUD } = await import('./hud.js');

function installMockEnvironment() {
  const elements = new Map(
    [
      'hud-alt', 'hud-summary', 'hud-summary-label', 'hud-mgrs', 'hud-latlon',
      'hud-gsd', 'hud-coll', 'hud-ona', 'hud-mode', 'hud-rec-dot', 'hud-timestamp'
    ].map((id) => [id, { textContent: '', style: {} }])
  );
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements.get(id) ?? null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  const viewer = {
    camera: {
      pitch: -Math.PI / 2,
      positionCartographic: {
        latitude: 0.5,
        longitude: 1.3,
        height: 5000,
      },
      computeViewRectangle: () => undefined,
      moveEnd: { addEventListener() {}, removeEventListener() {} },
    },
  };
  return {
    elements,
    viewer,
    restore() {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    },
  };
}

test('IntelHUD categorizes anomalies into INDUSTRY, AGRICULTURE, MINING, and WILDFIRE', () => {
  const env = installMockEnvironment();
  let hud;
  try {
    hud = new IntelHUD(env.viewer);

    // Industrial Flare / Process
    assert.equal(hud._getHazardCategory({ classification: { category: 'INDUSTRIAL_FLARE' } }), 'INDUSTRY');
    assert.equal(hud._getHazardCategory({ category: 'INDUSTRIAL_PROCESS' }), 'INDUSTRY');
    assert.equal(hud._getHazardCategory({ hazard_type: 'INDUSTRIAL_FIRE' }), 'INDUSTRY');
    assert.equal(hud._getHazardCategory({ title: 'Refinery Flare Stack' }), 'INDUSTRY');

    // Agricultural
    assert.equal(hud._getHazardCategory({ classification: { category: 'AGRICULTURAL_BURNING' } }), 'AGRICULTURE');
    assert.equal(hud._getHazardCategory({ title: 'Cropland Stubble Fire' }), 'AGRICULTURE');

    // Mining
    assert.equal(hud._getHazardCategory({ classification: { category: 'MINING_SMELTING' } }), 'MINING');
    assert.equal(hud._getHazardCategory({ title: 'Jharia Coalfield OCP' }), 'MINING');
    assert.equal(hud._getHazardCategory({ sector: 'Coal Mining & Extraction' }), 'MINING');

    // Wildfire
    assert.equal(hud._getHazardCategory({ classification: { category: 'FOREST_WILDFIRE' } }), 'WILDFIRE');
    assert.equal(hud._getHazardCategory({ hazard_type: 'WILDFIRE' }), 'WILDFIRE');
    assert.equal(hud._getHazardCategory({ title: 'Western Ghats Forest Fire' }), 'WILDFIRE');
  } finally {
    hud?.destroy();
    env.restore();
  }
});

test('IntelHUD generates Industry intelligence with facility name, chemicals, and risk', () => {
  const env = installMockEnvironment();
  let hud;
  try {
    hud = new IntelHUD(env.viewer);
    const indHazard = {
      classification: { category: 'INDUSTRIAL_FLARE' },
      title: 'IOCL Panipat Refinery Flare',
      facility: {
        name: 'Indian Oil Panipat Refinery Complex',
        sector: 'Petroleum Refining',
        distance_km: 1.8,
      },
      frp: 34.5,
      latitude: 29.39,
      longitude: 76.97,
    };

    const readout = hud._composeHazardIntelligence(indHazard);
    assert.match(readout, /Indian Oil Panipat Refinery Complex/);
    assert.match(readout, /1\.8 km/);
    assert.match(readout, /Chems:/);
    assert.match(readout, /Crude Oil|Benzene|LPG|Naphtha/);
    assert.match(readout, /FRP: 34\.5 MW/);
  } finally {
    hud?.destroy();
    env.restore();
  }
});

test('IntelHUD generates Agriculture intelligence with OSM location and stubble metrics', () => {
  const env = installMockEnvironment();
  let hud;
  try {
    hud = new IntelHUD(env.viewer);
    const agriHazard = {
      classification: { category: 'AGRICULTURAL_BURNING' },
      title: 'Paddy Residue Fire',
      frp: 12.3,
      latitude: 30.25,
      longitude: 75.35,
      weather: { windSpeedKmh: 18, windDirectionDegrees: 315 },
    };

    const readout = hud._composeHazardIntelligence(agriHazard);
    assert.match(readout, /Cropland Stubble Burn/);
    assert.match(readout, /Loc:/);
    assert.match(readout, /\(OSM\)/);
    assert.match(readout, /Wind: NW @ 18 km\/h/);
    assert.match(readout, /FRP: 12\.3 MW/);
  } finally {
    hud?.destroy();
    env.restore();
  }
});

test('IntelHUD generates Mining intelligence with mine name, coal/mineral type, and smoldering risk', () => {
  const env = installMockEnvironment();
  let hud;
  try {
    hud = new IntelHUD(env.viewer);
    const miningHazard = {
      classification: { category: 'MINING_SMELTING' },
      title: 'BCCL Jharia Colliery Pit No. 4',
      frp: 45.2,
      latitude: 23.75,
      longitude: 86.42,
    };

    const readout = hud._composeHazardIntelligence(miningHazard);
    assert.match(readout, /Mineral:/);
    assert.match(readout, /Coal Seam/);
    assert.match(readout, /Smoldering/);
    assert.match(readout, /FRP: 45\.2 MW/);
  } finally {
    hud?.destroy();
    env.restore();
  }
});

test('IntelHUD generates Wildfire intelligence with 1-hour spread projection and ROS', () => {
  const env = installMockEnvironment();
  let hud;
  try {
    hud = new IntelHUD(env.viewer);
    const fireHazard = {
      classification: { category: 'FOREST_WILDFIRE' },
      title: 'Bandipur Canopy Fire',
      frp: 68.0,
      latitude: 11.66,
      longitude: 76.63,
      weather: { windSpeedKmh: 20, windDirectionDegrees: 270 },
    };

    const readout = hud._composeHazardIntelligence(fireHazard);
    assert.match(readout, /1-Hr Forward Spread: ~\d+\.\d+ km/);
    assert.match(readout, /Rate: \d+\.\d+ km\/h/);
    assert.match(readout, /Perimeter Expansion:/);
    assert.match(readout, /FRP: 68\.0 MW/);
  } finally {
    hud?.destroy();
    env.restore();
  }
});

test('onHazardSelected dynamically switches header label for Industry, Agri, Mining, Wildfire', () => {
  const env = installMockEnvironment();
  let hud;
  try {
    hud = new IntelHUD(env.viewer);
    const labelEl = env.elements.get('hud-summary-label');

    // Industry
    hud.onHazardSelected({ classification: { category: 'INDUSTRIAL_FLARE' }, frp: 15 });
    assert.equal(labelEl.textContent, 'FACILITY & CHEMICAL HAZMAT');

    // Agriculture
    hud.onHazardSelected({ classification: { category: 'AGRICULTURAL_BURNING' }, frp: 10 });
    assert.equal(labelEl.textContent, 'AGRICULTURAL LOCATION (OSM)');

    // Mining
    hud.onHazardSelected({ classification: { category: 'MINING_SMELTING' }, frp: 25 });
    assert.equal(labelEl.textContent, 'MINING SECTOR INTELLIGENCE');

    // Wildfire
    hud.onHazardSelected({ classification: { category: 'FOREST_WILDFIRE' }, frp: 40 });
    assert.equal(labelEl.textContent, 'WILDFIRE SPREAD DYNAMICS (1-HR PROJECTION)');

    // Deselect
    hud.onHazardDeselected();
    assert.equal(labelEl.textContent, 'SUMMARY');
  } finally {
    hud?.destroy();
    env.restore();
  }
});
