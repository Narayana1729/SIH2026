import { defaultFirmsIngestor } from '../../src/firms/ingestion/firmsIngestor.js';
import { defaultClassifierEngine } from '../../src/firms/intelligence/classifierEngine.js';
import { defaultPersistenceEngine } from '../../src/firms/intelligence/persistenceEngine.js';
import { defaultFacilityContext } from '../../src/firms/context/facilityContext.js';
import { defaultHistoricalFirmsStore } from '../services/historicalFirmsStore.mjs';
import { defaultMLInferenceService } from '../services/mlInferenceService.mjs';
import { computePercentile } from '../services/metrics.mjs';
import { sendJson, sendError } from '../middleware/security.mjs';
import { validateRequestBody } from '../middleware/validation.mjs';

let cachedProcessedState = null;
let lastProcessedTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Helper to get or compute latest classified state from active FIRMS detections.
 */
async function getOrComputeClassifiedEvents(bbox = null) {
  const now = Date.now();
  if (cachedProcessedState && !bbox && now - lastProcessedTime < CACHE_TTL_MS) {
    return cachedProcessedState;
  }

  const detections = await defaultFirmsIngestor.fetchDetections({ bbox });
  const result = defaultClassifierEngine.classifyBatch(detections);

  if (!bbox) {
    cachedProcessedState = result;
    lastProcessedTime = now;
  }

  return result;
}

/**
 * Computes parametric, non-parametric, percentile, and conditional Pareto tail statistics for FRP.
 *
 * @param {Array<number>} rawValues - Array of Fire Radiative Power (MW) values
 * @returns {object} Rigorous statistical breakdown
 */
export function computeFrpDistribution(rawValues) {
  const values = (rawValues || [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  const n = values.length;
  if (n < 5) {
    return {
      sample_size: n,
      status: 'INSUFFICIENT_SAMPLE_SIZE',
      note: 'Sample size N < 5 is too small for statistical distribution modeling.',
    };
  }

  // 1. Parametric stats
  const sum = values.reduce((s, x) => s + x, 0);
  const mean = sum / n;
  const variance = values.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  let skewness = null;
  let kurtosis = null;
  if (stdDev > 0 && n >= 3) {
    const m3 = values.reduce((s, x) => s + Math.pow((x - mean) / stdDev, 3), 0);
    skewness = Math.round((n / ((n - 1) * (n - 2))) * m3 * 1000) / 1000;
  }
  if (stdDev > 0 && n >= 4) {
    const m4 = values.reduce((s, x) => s + Math.pow((x - mean) / stdDev, 4), 0);
    const kFactor = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const kOffset = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    kurtosis = Math.round((kFactor * m4 - kOffset) * 1000) / 1000;
  }

  // 2. Non-parametric stats
  const p10 = computePercentile(values, 10);
  const p25 = computePercentile(values, 25);
  const p50 = computePercentile(values, 50);
  const p75 = computePercentile(values, 75);
  const p90 = computePercentile(values, 90);
  const p95 = computePercentile(values, 95);
  const p99 = computePercentile(values, 99);

  const iqr = Math.round((p75 - p25) * 1000) / 1000;
  const absDevs = values.map((x) => Math.abs(x - p50)).sort((a, b) => a - b);
  const mad = computePercentile(absDevs, 50);

  // 3. Conditional Pareto Power-Law Tail Estimation (Clauset / Wooster MLE)
  // x_min chosen conditionally on P75 or 10 MW threshold for significant combustion energy
  const candidateXmin = Math.max(10.0, p75);
  const tail = values.filter((x) => x >= candidateXmin);
  let pareto = null;
  if (tail.length >= 5) {
    const logSum = tail.reduce((s, x) => s + Math.log(x / candidateXmin), 0);
    const alpha = logSum > 0 ? 1 + (tail.length / logSum) : null;
    pareto = {
      xmin: Math.round(candidateXmin * 10) / 10,
      alpha: alpha ? Math.round(alpha * 1000) / 1000 : null,
      tail_sample_count: tail.length,
      tail_fraction_pct: Math.round((tail.length / n) * 1000) / 10,
      method: 'MLE_CONDITIONAL_ON_XMIN',
    };
  } else {
    pareto = {
      xmin: Math.round(candidateXmin * 10) / 10,
      alpha: null,
      tail_sample_count: tail.length,
      note: 'Insufficient tail samples (N < 5) to fit Pareto power law',
      method: 'MLE_CONDITIONAL_ON_XMIN',
    };
  }

  // 4. Histogram bins
  const bins = {
    under_5mw: values.filter((x) => x < 5).length,
    from_5_to_20mw: values.filter((x) => x >= 5 && x < 20).length,
    from_20_to_50mw: values.filter((x) => x >= 20 && x < 50).length,
    from_50_to_100mw: values.filter((x) => x >= 50 && x < 100).length,
    over_100mw: values.filter((x) => x >= 100).length,
  };

  return {
    sample_size: n,
    parametric: {
      mean_mw: Math.round(mean * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      standard_deviation_mw: Math.round(stdDev * 100) / 100,
      skewness,
      excess_kurtosis: kurtosis,
    },
    non_parametric: {
      min_mw: values[0],
      max_mw: values[n - 1],
      median_p50_mw: p50,
      q1_p25_mw: p25,
      q3_p75_mw: p75,
      iqr_mw: iqr,
      mad_mw: mad,
    },
    percentiles: {
      p10, p25, p50, p75, p90, p95, p99,
    },
    pareto_tail: pareto,
    histogram_bins: bins,
  };
}

/**
 * Master Request Dispatcher for all /api/v1/firms/* routes.
 */
export async function handleFirmsApiRoute(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || 'GET';

  // Ensure real historical telemetry store is loaded
  await defaultHistoricalFirmsStore.ensureLoaded();

  try {
    // 0. GET /api/firms -> Active Live FIRMS Thermal Anomalies for Map Layer (supports ?date=YYYY-MM-DD)
    if ((pathname === '/api/firms' || pathname === '/api/firms/') && method === 'GET') {
      const bbox = url.searchParams.get('bbox') || '65,5,100,38';
      const days = url.searchParams.get('days') || '1';
      const source = url.searchParams.get('source') || 'VIIRS_NOAA20_NRT';
      const date = url.searchParams.get('date');
      const mode = url.searchParams.get('mode');

      let fires = [];
      if (mode === 'stored' || source === 'stored' || source === 'archive') {
        // Direct local stored archive query - no upstream live API call
        const targetDate = date || defaultHistoricalFirmsStore.latestDate || '2026-08-25';
        fires = defaultHistoricalFirmsStore.getFiresForDate(targetDate, bbox);
        if (!fires || fires.length === 0) {
          fires = defaultHistoricalFirmsStore.getFiresForDate(targetDate, null);
        }
      } else if (date) {
        // 1. Try Live NASA FIRMS API with Map Key for requested date
        try {
          const liveDetections = await defaultFirmsIngestor.fetchDetections({ bbox, days: '1', source, date });
          if (liveDetections && liveDetections.length > 0) {
            fires = liveDetections.map((d) => {
              const obs = d.observed || {};
              const acqTime = obs.acquisition_time || '';
              const rawTime = acqTime.includes('T') ? acqTime.split('T')[1].replace(/[:Z]/g, '').slice(0, 4) : '0000';
              return {
                lat: obs.latitude,
                lon: obs.longitude,
                brightness: obs.brightness_temp_k,
                frp: obs.frp_mw,
                confidence: obs.confidence_pct >= 80 ? 'h' : obs.confidence_pct >= 50 ? 'n' : 'l',
                daynight: obs.daynight || 'D',
                acqDate: date,
                acqTime: rawTime,
                instrument: obs.instrument || 'VIIRS',
                satellite: obs.satellite || 'NOAA-20',
              };
            });
          }
        } catch (err) {
          console.warn('[FirmsAPI] Upstream live date fetch error:', err.message);
        }

        // 2. Fallback to local genuine indexed telemetry store if needed
        if (fires.length === 0) {
          const realFires = defaultHistoricalFirmsStore.getFiresForDate(date, bbox);
          if (realFires && realFires.length > 0) {
            fires = realFires;
          } else {
            fires = defaultHistoricalFirmsStore.getFiresForDate(date, null);
          }
        }
      } else {
        // Live Today: Query NASA FIRMS API with MAP_KEY
        try {
          const detections = await defaultFirmsIngestor.fetchDetections({ bbox, days, source });
          fires = (detections || []).map((d) => {
            const obs = d.observed || {};
            const acqTime = obs.acquisition_time || '';
            const acqDate = acqTime.includes('T') ? acqTime.split('T')[0] : '';
            const rawTime = acqTime.includes('T') ? acqTime.split('T')[1].replace(/[:Z]/g, '').slice(0, 4) : '0000';
            return {
              lat: obs.latitude,
              lon: obs.longitude,
              brightness: obs.brightness_temp_k,
              frp: obs.frp_mw,
              confidence: obs.confidence_pct >= 80 ? 'h' : obs.confidence_pct >= 50 ? 'n' : 'l',
              daynight: obs.daynight || 'D',
              acqDate: acqDate || date || new Date().toISOString().split('T')[0],
              acqTime: rawTime,
              instrument: obs.instrument || 'VIIRS',
              satellite: obs.satellite || 'NOAA-20',
            };
          });
        } catch (err) {
          console.warn('[FirmsAPI] Live FIRMS fetch error:', err.message);
        }

        // If upstream live returned 0 (e.g. empty NRT pass or rate limit), fall back to latest verified genuine telemetry pass
        if (fires.length === 0) {
          const latest = defaultHistoricalFirmsStore.latestDate || '2026-08-25';
          const realFires = defaultHistoricalFirmsStore.getFiresForDate(latest, bbox);
          fires = (realFires && realFires.length > 0) ? realFires : defaultHistoricalFirmsStore.getFiresForDate(latest, null);
        }
      }

      return sendJson(
        res,
        200,
        {
          fires,
          fetchedAt: Date.now(),
          date: date || (fires.length > 0 ? fires[0].acqDate : null),
          stale: false,
          count: fires.length,
          dataSource: 'NASA FIRMS / VIIRS & MODIS Telemetry',
        },
        { 'Cache-Control': 'public, max-age=180' },
        req
      );
    }

    // 0b. GET /api/v1/firms/timeline -> Daily Aggregated Satellite Overpass & Thermal Stats for Month
    if (pathname === '/api/v1/firms/timeline' && method === 'GET') {
      const year = parseInt(url.searchParams.get('year') || '2026', 10);
      const month = parseInt(url.searchParams.get('month') || '8', 10);

      const monthData = defaultHistoricalFirmsStore.getMonthStats(year, month);
      const availableMonths = defaultHistoricalFirmsStore.getAvailableMonths();

      return sendJson(
        res,
        200,
        {
          ...monthData,
          availableMonths,
        },
        { 'Cache-Control': 'public, max-age=600' },
        req
      );
    }

    // 0c. GET /api/v1/firms/timeline/months -> Available months in actual dataset
    if (pathname === '/api/v1/firms/timeline/months' && method === 'GET') {
      const months = defaultHistoricalFirmsStore.getAvailableMonths();
      return sendJson(res, 200, { months }, { 'Cache-Control': 'public, max-age=600' }, req);
    }

    // 1. GET /api/v1/firms/detections -> Ingested & Normalized FIRMS observations
    if (pathname === '/api/v1/firms/detections' && method === 'GET') {
      const bbox = url.searchParams.get('bbox');
      const days = url.searchParams.get('days') || '1';
      const source = url.searchParams.get('source') || 'VIIRS_NOAA20_NRT';
      const detections = await defaultFirmsIngestor.fetchDetections({ bbox, days, source });

      return sendJson(
        res,
        200,
        {
          status: 'ok',
          count: detections.length,
          detections,
        },
        { 'X-Total-Count': String(detections.length) },
        req
      );
    }

    // 2. GET /api/v1/firms/events -> Filterable classified thermal events
    if (pathname === '/api/v1/firms/events' && method === 'GET') {
      const bbox = url.searchParams.get('bbox');
      const classificationFilter = url.searchParams.get('classification');
      const subclassificationFilter = url.searchParams.get('subclassification');
      const facilityTypeFilter = url.searchParams.get('facility_type');
      const minFrp = parseFloat(url.searchParams.get('min_frp') || '0');
      const limit = parseInt(url.searchParams.get('limit') || '500', 10);

      const batchData = await getOrComputeClassifiedEvents(bbox);
      let filtered = batchData.events;

      if (classificationFilter) {
        filtered = filtered.filter((e) => e.derived_intelligence.classification === classificationFilter.toUpperCase());
      }
      if (subclassificationFilter) {
        filtered = filtered.filter((e) => e.derived_intelligence.subclassification === subclassificationFilter.toUpperCase());
      }
      if (facilityTypeFilter) {
        filtered = filtered.filter((e) => e.derived_intelligence.facility?.facility_type === facilityTypeFilter.toUpperCase());
      }
      if (minFrp > 0) {
        filtered = filtered.filter((e) => e.observed.frp_mw >= minFrp);
      }

      const results = filtered.slice(0, limit);

      return sendJson(
        res,
        200,
        {
          status: 'ok',
          count: results.length,
          total_available: filtered.length,
          events: results,
          geojson: {
            type: 'FeatureCollection',
            features: results.map((e) => ({
              type: 'Feature',
              geometry: e.geometry,
              properties: {
                event_id: e.event_id,
                industrial_status: e.derived_intelligence.industrial_status,
                classification: e.derived_intelligence.classification,
                subclassification: e.derived_intelligence.subclassification,
                confidence: e.derived_intelligence.classification_confidence,
                frp_mw: e.observed.frp_mw,
                facility_name: e.derived_intelligence.facility?.name || null,
                risk_level: e.derived_intelligence.risk_level,
              },
            })),
          },
        },
        {},
        req
      );
    }

    // 3. GET /api/v1/firms/events/:id -> Single event with full telemetry & evidence basis
    if (pathname.startsWith('/api/v1/firms/events/') && method === 'GET') {
      const eventId = decodeURIComponent(pathname.replace('/api/v1/firms/events/', ''));
      const batchData = await getOrComputeClassifiedEvents();
      const event = batchData.events.find((e) => e.event_id === eventId);

      if (!event) {
        return sendError(res, 404, 'EVENT_NOT_FOUND', `Thermal event '${eventId}' not found.`, [], req);
      }

      return sendJson(res, 200, { status: 'ok', event }, {}, req);
    }

    // 4. GET /api/v1/firms/industrial-events -> Segregated industrial events only
    if (pathname === '/api/v1/firms/industrial-events' && method === 'GET') {
      const batchData = await getOrComputeClassifiedEvents();
      const industrialEvents = batchData.segregated.industrial_events;

      return sendJson(
        res,
        200,
        {
          status: 'ok',
          count: industrialEvents.length,
          industrial_events: industrialEvents,
          summary: batchData.summary.industrial,
        },
        {},
        req
      );
    }

    // 5. GET /api/v1/firms/non-industrial-events -> Segregated non-industrial events (wildfires, stubble)
    if (pathname === '/api/v1/firms/non-industrial-events' && method === 'GET') {
      const batchData = await getOrComputeClassifiedEvents();
      const nonIndustrialEvents = batchData.segregated.non_industrial_events;

      return sendJson(
        res,
        200,
        {
          status: 'ok',
          count: nonIndustrialEvents.length,
          non_industrial_events: nonIndustrialEvents,
          summary: batchData.summary.non_industrial,
        },
        {},
        req
      );
    }

    // 6. GET /api/v1/firms/thermal-sources -> Persistent thermal sources / clusters
    if (pathname === '/api/v1/firms/thermal-sources' && method === 'GET') {
      await getOrComputeClassifiedEvents();
      const sources = Array.from(defaultPersistenceEngine.sources.values()).map((s) => s.toRecord());

      return sendJson(
        res,
        200,
        {
          status: 'ok',
          count: sources.length,
          thermal_sources: sources,
        },
        {},
        req
      );
    }

    // 7. GET /api/v1/firms/facilities -> Industrial infrastructure catalog
    if (pathname === '/api/v1/firms/facilities' && method === 'GET') {
      const lat = parseFloat(url.searchParams.get('lat') || '');
      const lon = parseFloat(url.searchParams.get('lon') || '');
      const radiusKm = parseFloat(url.searchParams.get('radius_km') || '25');

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const nearby = defaultFacilityContext.findNearby(lat, lon, radiusKm);
        return sendJson(res, 200, { status: 'ok', count: nearby.length, facilities: nearby }, {}, req);
      }

      const all = defaultFacilityContext.getFacilities();
      return sendJson(res, 200, { status: 'ok', count: all.length, facilities: all }, {}, req);
    }

    // 8. GET /api/v1/firms/analytics -> Segregation metrics & FRP distributions
    if (pathname === '/api/v1/firms/analytics' && method === 'GET') {
      const batchData = await getOrComputeClassifiedEvents();
      const events = batchData.events || [];

      // Extract FRP values by population
      const pooledFrp = events.map((e) => e.observed?.frp_mw).filter((x) => x !== undefined);
      const industrialEvents = events.filter((e) => e.derived_intelligence?.classification === 'INDUSTRIAL');
      const nonIndustrialEvents = events.filter((e) => e.derived_intelligence?.classification === 'NON_INDUSTRIAL');

      const industrialFrp = industrialEvents.map((e) => e.observed?.frp_mw);
      const nonIndustrialFrp = nonIndustrialEvents.map((e) => e.observed?.frp_mw);

      // Subtypes
      const routineFlareFrp = events.filter((e) => e.derived_intelligence?.subclassification === 'GAS_FLARE').map((e) => e.observed?.frp_mw);
      const industrialFireFrp = events.filter((e) => e.derived_intelligence?.subclassification === 'INDUSTRIAL_FIRE').map((e) => e.observed?.frp_mw);
      const wildfireFrp = events.filter((e) => e.derived_intelligence?.subclassification === 'WILDFIRE').map((e) => e.observed?.frp_mw);
      const agriculturalFrp = events.filter((e) => e.derived_intelligence?.subclassification === 'AGRICULTURAL_BURNING').map((e) => e.observed?.frp_mw);
      const miningFrp = events.filter((e) => e.derived_intelligence?.subclassification === 'MINING_THERMAL_ACTIVITY').map((e) => e.observed?.frp_mw);

      const distributions = {
        pooled: computeFrpDistribution(pooledFrp),
        industrial: computeFrpDistribution(industrialFrp),
        non_industrial: computeFrpDistribution(nonIndustrialFrp),
        subtypes: {
          routine_flare: computeFrpDistribution(routineFlareFrp),
          industrial_fire: computeFrpDistribution(industrialFireFrp),
          wildfire: computeFrpDistribution(wildfireFrp),
          agricultural: computeFrpDistribution(agriculturalFrp),
          mining: computeFrpDistribution(miningFrp),
        },
      };

      return sendJson(
        res,
        200,
        {
          status: 'ok',
          analytics: {
            timestamp: new Date().toISOString(),
            summary: batchData.summary,
            industrial_percentage: batchData.summary.total > 0
              ? `${Math.round((batchData.summary.industrial.total / batchData.summary.total) * 1000) / 10}%`
              : '0%',
            non_industrial_percentage: batchData.summary.total > 0
              ? `${Math.round((batchData.summary.non_industrial.total / batchData.summary.total) * 1000) / 10}%`
              : '0%',
            frp_distributions: distributions,
          },
        },
        {},
        req
      );
    }

    // 8b. GET /api/v1/firms/export -> Export Segregated Events as standard GIS GeoJSON FeatureCollection or CSV
    if (pathname === '/api/v1/firms/export' && method === 'GET') {
      const format = (url.searchParams.get('format') || 'geojson').toLowerCase();
      const categoryFilter = url.searchParams.get('category');
      const batchData = await getOrComputeClassifiedEvents();
      let events = batchData.events;

      if (categoryFilter) {
        events = events.filter((e) => e.derived_intelligence.classification === categoryFilter.toUpperCase());
      }

      if (format === 'csv') {
        const headers = ['Event_ID', 'Classification', 'Subclassification', 'Latitude', 'Longitude', 'FRP_MW', 'Confidence', 'Facility_Name', 'Risk_Level'];
        const rows = events.map((e) => [
          `"${e.event_id}"`,
          `"${e.derived_intelligence.classification}"`,
          `"${e.derived_intelligence.subclassification}"`,
          e.geometry.coordinates[1],
          e.geometry.coordinates[0],
          e.observed.frp_mw,
          e.derived_intelligence.classification_confidence,
          `"${(e.derived_intelligence.facility?.name || '').replace(/"/g, '""')}"`,
          `"${e.derived_intelligence.risk_level}"`,
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="pyrosat-segregated-thermal-events.csv"',
        });
        res.end(csvContent);
        return;
      }

      const geojson = {
        type: 'FeatureCollection',
        metadata: {
          platform: 'PyroSat Industrial Thermal & Fire Intelligence',
          exportedAt: new Date().toISOString(),
          total_features: events.length,
          summary: batchData.summary,
        },
        features: events.map((e) => ({
          type: 'Feature',
          geometry: e.geometry,
          properties: {
            event_id: e.event_id,
            industrial_status: e.derived_intelligence.industrial_status,
            classification: e.derived_intelligence.classification,
            subclassification: e.derived_intelligence.subclassification,
            confidence: e.derived_intelligence.classification_confidence,
            frp_mw: e.observed.frp_mw,
            facility_name: e.derived_intelligence.facility?.name || null,
            facility_sector: e.derived_intelligence.facility?.facility_type || null,
            flame_temp_k: e.derived_intelligence.physical_inversion?.flame_temperature_k || null,
            risk_level: e.derived_intelligence.risk_level,
          },
        })),
      };

      return sendJson(res, 200, geojson, { 'Content-Type': 'application/geo+json' }, req);
    }

    // 9a. GET /api/v1/firms/ml/status -> Health & status of Python ML runtime inference engine
    if (pathname === '/api/v1/firms/ml/status' && method === 'GET') {
      return sendJson(
        res,
        200,
        {
          status: 'ok',
          ml_runtime_ready: defaultMLInferenceService.isReady,
          model_name: 'HierarchicalMultiModalClassifier',
          feature_count: 26,
          inference_engine: defaultMLInferenceService.isReady ? 'ACTIVE' : 'FALLBACK_MODE',
          fallback_strategy: 'DETERMINISTIC_RULE_BASED_ENGINE',
          timestamp: new Date().toISOString(),
        },
        {},
        req
      );
    }

    // 9b. POST /api/v1/firms/classify -> On-demand classification for arbitrary detection
    if (pathname === '/api/v1/firms/classify' && method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');

          // Input validation gate
          const validation = validateRequestBody('/api/v1/firms/classify', payload);
          if (!validation.valid) {
            return sendError(res, 422, 'VALIDATION_ERROR',
              'Request body failed schema validation',
              validation.errors, req
            );
          }

          const engineMode = (url.searchParams.get('engine') || payload.engine || '').toLowerCase();

          if (Array.isArray(payload.detections)) {
            if (engineMode === 'ml') {
              const mlBatchResult = await defaultMLInferenceService.classifyBatch(payload.detections);
              return sendJson(res, 200, mlBatchResult, {}, req);
            }
            const batchResult = defaultClassifierEngine.classifyBatch(payload.detections);
            return sendJson(res, 200, batchResult, {}, req);
          }

          if (engineMode === 'ml') {
            const mlEvent = await defaultMLInferenceService.classifyThermalEvent(payload);
            return sendJson(res, 200, { status: 'ok', event: mlEvent }, {}, req);
          }

          // Default: Deterministic baseline with modeled estimates and ML inference metadata
          const singleEvent = defaultClassifierEngine.classifyEvent(payload);

          // Clearly distinguish modeled physical estimates from observed telemetry
          singleEvent.modeled_estimates = {
            flame_temperature_k: singleEvent.derived_intelligence?.physical_inversion?.flame_temperature_k ?? null,
            flame_area_m2: singleEvent.derived_intelligence?.physical_inversion?.flame_area_m2 ?? null,
            modeled_ndvi_proxy: singleEvent.derived_intelligence?.ndvi ?? null,
            is_ndvi_measured: false,
            ndvi_provenance: 'ESTIMATED_REGIONAL_CLIMATOLOGY',
          };

          if (defaultMLInferenceService.isReady) {
            try {
              const mlPrediction = await defaultMLInferenceService.classifyThermalEvent(payload);
              singleEvent.ml_inference = {
                is_available: true,
                source: mlPrediction.inference_source,
                model_info: mlPrediction.model_info,
              };
            } catch (err) {
              singleEvent.ml_inference = {
                is_available: false,
                fallback_reason: err.message,
              };
            }
          } else {
            singleEvent.ml_inference = {
              is_available: false,
              fallback_reason: 'ML worker initializing or offline; using deterministic baseline',
            };
          }

          return sendJson(res, 200, { status: 'ok', event: singleEvent }, {}, req);
        } catch (err) {
          return sendError(res, 400, 'INVALID_PAYLOAD', 'Invalid JSON body for classification', [err.message], req);
        }
      });
      return;
    }

    return sendError(res, 404, 'ENDPOINT_NOT_FOUND', `Endpoint not found: ${pathname}`, [], req);
  } catch (err) {
    console.error(`[FirmsApi Error | Trace: ${req.traceId}]`, err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error processing FIRMS request', [err.message], req);
  }
}
