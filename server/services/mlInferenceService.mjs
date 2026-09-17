/**
 * @module server/services/mlInferenceService
 * @description Production ML Runtime Inference Service with Self-Healing Process Lifecycle.
 *
 * Bridges the JS API Gateway to the 26-D Hierarchical Multi-Modal AI model:
 * - Manages a single-flight Python stdio worker process with explicit state machine.
 * - Single-flight restart prevention avoids duplicate worker processes.
 * - Health verification via PING/PONG handshake before marking ready.
 * - Exponential backoff on crashes with explicit fallback telemetry.
 * - Transparent epistemic boundary:
 *     1. Observed satellite telemetry (measured data)
 *     2. Modeled physical estimates (Dozier temperature, area, proxy NDVI)
 *     3. Predicted intelligence (ML classification, confidence, explainability evidence)
 *     4. Operational guardrail advisories (isolated without modifying ML probabilities)
 */

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { defaultClassifierEngine } from '../../src/firms/intelligence/classifierEngine.js';
import { PrimaryClassification, IndustrialSubtype, NonIndustrialSubtype, RiskLevel } from '../../src/firms/domain/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WorkerState = Object.freeze({
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  READY: 'READY',
  RECOVERING: 'RECOVERING',
});

export class MLInferenceService {
  constructor(options = {}) {
    this.workerPath = options.workerPath || path.join(__dirname, 'ml_inference_worker.py');
    
    const candidatePythons = [
      options.pythonExecutable,
      process.env.PYTHON_PATH,
      path.resolve(__dirname, '../../FirmsBackend/Ai-Flame-Detection/.venv/bin/python3'),
      path.resolve(__dirname, '../../ml/.venv/bin/python3'),
      'python3',
    ].filter(Boolean);

    this.pythonExecutable = candidatePythons.find((p) => p === 'python3' || existsSync(p)) || 'python3';
    this.requestTimeoutMs = options.requestTimeoutMs || 5000;
    this.enabled = options.enabled ?? (process.env.ENABLE_ML_RUNTIME !== 'false');
    this.autoSpawn = options.autoSpawn ?? (process.env.NODE_ENV !== 'test');

    this.process = null;
    this.state = WorkerState.STOPPED;
    this.initError = null;
    this.pendingRequests = new Map();
    this.stdoutBuffer = '';

    // Resilience & Single-Flight State Machine
    this.isSpawning = false;
    this.restartAttempts = 0;
    this.maxRestartAttempts = options.maxRestartAttempts || 5;
    this.baseBackoffMs = options.baseBackoffMs || 500;
    this.restartTimer = null;

    if (this.enabled && this.autoSpawn) {
      this._spawnWorker();
    }
  }

  get isReady() {
    return this.state === WorkerState.READY && this.process && !this.process.killed;
  }

  async ensureReady(timeoutMs = 5000) {
    if (this.isReady) return true;
    if (this.state === WorkerState.STOPPED || (!this.process && !this.isSpawning)) {
      this._spawnWorker();
    }
    const start = Date.now();
    while (!this.isReady && (Date.now() - start < timeoutMs)) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return this.isReady;
  }

  _spawnWorker() {
    if (this.isSpawning || this.state === WorkerState.STARTING || this.state === WorkerState.READY) {
      return;
    }
    this.isSpawning = true;
    this.state = WorkerState.STARTING;

    try {
      const sriPath = path.resolve(__dirname, '../../FirmsBackend/Ai-Flame-Detection/sri');
      const existingPyPath = process.env.PYTHONPATH || '';
      const combinedPyPath = existingPyPath ? `${sriPath}:${existingPyPath}` : sriPath;

      this.process = spawn(this.pythonExecutable, [this.workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONPATH: combinedPyPath },
      });

      if (this.process.unref) this.process.unref();
      if (this.process.stdin?.unref) this.process.stdin.unref();
      if (this.process.stdout?.unref) this.process.stdout.unref();
      if (this.process.stderr?.unref) this.process.stderr.unref();

      process.once('beforeExit', () => this.shutdown());
      process.once('exit', () => this.shutdown());

      this.process.stdout.setEncoding('utf8');
      this.process.stderr.setEncoding('utf8');

      this.process.stdout.on('data', (chunk) => {
        this.stdoutBuffer += chunk;
        let lineEnd;
        while ((lineEnd = this.stdoutBuffer.indexOf('\n')) !== -1) {
          const line = this.stdoutBuffer.slice(0, lineEnd).trim();
          this.stdoutBuffer = this.stdoutBuffer.slice(lineEnd + 1);
          if (line) {
            this._handleWorkerResponse(line);
          }
        }
      });

      this.process.stderr.on('data', async (chunk) => {
        if (chunk.includes('ML_WORKER_READY')) {
          // Perform active PING/PONG health handshake before confirming READY
          const healthy = await this._verifyHealthPing(2000);
          if (healthy) {
            this.state = WorkerState.READY;
            this.initError = null;
            this.restartAttempts = 0;
            this.isSpawning = false;
          } else {
            this.state = WorkerState.RECOVERING;
            this.initError = 'ML Worker failed initial PING health check';
            this.isSpawning = false;
            this._scheduleRestart('HEALTH_CHECK_FAILED');
          }
        } else if (chunk.includes('ML_WORKER_INIT_ERROR')) {
          this.state = WorkerState.RECOVERING;
          this.initError = chunk.trim();
          this.isSpawning = false;
          this._scheduleRestart('INIT_ERROR');
        }
      });

      this.process.on('exit', (code, signal) => {
        this.state = WorkerState.RECOVERING;
        this.isSpawning = false;

        // Reject pending requests with explicit recovery error
        for (const [id, req] of this.pendingRequests.entries()) {
          clearTimeout(req.timer);
          req.reject(new Error(`ML Worker exited with code ${code}, signal ${signal}`));
        }
        this.pendingRequests.clear();

        // Single-flight automatic recovery with exponential backoff
        this._scheduleRestart(code, signal);
      });

      this.process.on('error', (err) => {
        this.state = WorkerState.RECOVERING;
        this.initError = err.message;
        this.isSpawning = false;
        this._scheduleRestart('SPAWN_ERROR');
      });
    } catch (err) {
      this.state = WorkerState.RECOVERING;
      this.initError = err.message;
      this.isSpawning = false;
      this._scheduleRestart('EXCEPTION');
    }
  }

  /**
   * Schedules single-flight restart using bounded exponential backoff.
   */
  _scheduleRestart(reasonCode) {
    if (this.restartTimer) {
      return; // Single-flight active timer already scheduled
    }

    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.warn(`[MLInferenceService] Max restart attempts (${this.maxRestartAttempts}) reached. Pausing auto-restart.`);
      this.state = WorkerState.STOPPED;
      return;
    }

    const backoffMs = Math.min(5000, this.baseBackoffMs * Math.pow(2, this.restartAttempts));
    this.restartAttempts++;

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.process = null;
      this._spawnWorker();
    }, backoffMs);
  }

  /**
   * Health verification sending PING to worker stdio.
   */
  async _verifyHealthPing(timeoutMs = 2000) {
    if (!this.process || !this.process.stdin || this.process.killed) return false;
    return new Promise((resolve) => {
      const pingId = `ping_${Date.now()}`;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(pingId);
        resolve(false);
      }, timeoutMs);

      this.pendingRequests.set(pingId, {
        resolve: () => {
          clearTimeout(timer);
          resolve(true);
        },
        reject: () => {
          clearTimeout(timer);
          resolve(false);
        },
        timer,
      });

      try {
        this.process.stdin.write('PING\n');
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(pingId);
        resolve(false);
      }
    });
  }

  _handleWorkerResponse(line) {
    try {
      const resp = JSON.parse(line);
      // Handle PONG response
      if (resp.status === 'PONG') {
        for (const [id, req] of this.pendingRequests.entries()) {
          if (id.startsWith('ping_')) {
            this.pendingRequests.delete(id);
            req.resolve(resp);
            return;
          }
        }
      }

      const reqId = resp.id;
      if (reqId && this.pendingRequests.has(reqId)) {
        const { resolve, timer } = this.pendingRequests.get(reqId);
        clearTimeout(timer);
        this.pendingRequests.delete(reqId);
        resolve(resp);
      }
    } catch (err) {
      console.warn('[MLInferenceService] Failed to parse worker response line:', err.message);
    }
  }

  /**
   * Invokes ML model via worker process with strict timeout.
   */
  async _predictViaWorker(detection) {
    if (!this.isReady || !this.process || this.process.killed) {
      throw new Error(this.initError || 'ML Worker process is not ready');
    }

    const id = crypto.randomUUID();
    const payload = JSON.stringify({ id, detection }) + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`ML inference request timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.process.stdin.write(payload);
    });
  }

  /**
   * Translates an ML model prediction class into the domain classification schema.
   */
  _mapMlClassToDomain(mlClassName) {
    switch (mlClassName) {
      case 'INDUSTRIAL_ROUTINE_FLARE':
        return {
          primary: PrimaryClassification.INDUSTRIAL,
          secondary: IndustrialSubtype.GAS_FLARE,
          riskLevel: RiskLevel.LOW,
        };
      case 'INDUSTRIAL_ACCIDENTAL_FIRE':
        return {
          primary: PrimaryClassification.INDUSTRIAL,
          secondary: IndustrialSubtype.INDUSTRIAL_FIRE,
          riskLevel: RiskLevel.CRITICAL,
        };
      case 'NATURAL_FOREST_WILDFIRE':
        return {
          primary: PrimaryClassification.NON_INDUSTRIAL,
          secondary: NonIndustrialSubtype.WILDFIRE,
          riskLevel: RiskLevel.HIGH,
        };
      case 'AGRICULTURAL_CROP_BURNING':
        return {
          primary: PrimaryClassification.NON_INDUSTRIAL,
          secondary: NonIndustrialSubtype.AGRICULTURAL_BURNING,
          riskLevel: RiskLevel.LOW,
        };
      case 'MINING_COAL_SEAM_FIRE':
        return {
          primary: PrimaryClassification.INDUSTRIAL,
          secondary: IndustrialSubtype.MINING_THERMAL_ACTIVITY,
          riskLevel: RiskLevel.HIGH,
        };
      default:
        return {
          primary: PrimaryClassification.NON_INDUSTRIAL,
          secondary: NonIndustrialSubtype.VEGETATION_FIRE,
          riskLevel: RiskLevel.MEDIUM,
        };
    }
  }

  /**
   * Formats an ML prediction and observation into the standardized domain event structure.
   */
  _formatMlEvent(detection, pred, modelVersion = 'v1.0.0-hierarchical-gb-et') {
    const feat = pred.features || {};
    const meta = pred.metadata || {};
    const domainMapping = this._mapMlClassToDomain(pred.class_name);

    const obs = detection.observed || detection;
    const lat = Number(obs.latitude ?? obs.lat) || 0;
    const lon = Number(obs.longitude ?? obs.lon) || 0;
    const frpMw = Number(obs.frp_mw ?? obs.frp) || 10.0;
    const timestamp = obs.acquisition_time || obs.timestamp || new Date().toISOString();

    const basis = Object.entries(pred.feature_contributions || {}).map(([feature, weight]) => ({
      feature,
      weight,
      description: `Stage-1 Feature Attribution (${feature}): ${weight}`,
    }));

    const lulcMeta = meta.lulc || {
      forest_fraction: feat.forest_fraction ?? null,
      cropland_fraction: feat.cropland_fraction ?? null,
      builtup_fraction: feat.builtup_fraction ?? null,
      bare_fraction: feat.bare_fraction ?? null,
      dominant_class: meta.dominant_lulc || 'UNKNOWN',
      is_lulc_measured: false,
      status: 'DATA_UNAVAILABLE',
    };

    const opticalMeta = meta.optical || {
      ndvi: feat.ndvi_val ?? null,
      nbr: feat.nbr_val ?? null,
      swir_ratio: feat.swir_ratio_val ?? null,
      optical_data_available: false,
      cloud_mask_applied: false,
      status: 'DATA_UNAVAILABLE',
    };

    const rawConf = typeof pred.raw_model_confidence === 'number'
      ? pred.raw_model_confidence
      : (typeof pred.confidence_score === 'number' ? pred.confidence_score / 100.0 : 0.85);

    return {
      event_id: detection.detection_id || `thermal_event_${lat.toFixed(4)}_${lon.toFixed(4)}_${timestamp.replace(/[:.-]/g, '')}`,
      category: pred.class_name || domainMapping.primary,
      inference_source: 'ML_HIERARCHICAL_ENSEMBLE',
      is_ml_predicted: true,
      model_info: {
        version: modelVersion,
        class_id: pred.class_id,
        class_name: pred.class_name,
        confidence_score: pred.confidence_score,
        raw_model_confidence: rawConf,
        stage1_probability: pred.stage1_probability ?? pred.industrial_probability,
        stage2_probabilities: pred.stage2_probabilities ?? null,
        guardrail_flags: pred.guardrail_flags ?? [],
        confidence_band: pred.confidence_band,
        explainability_evidence: pred.explainability_evidence,
        xai: pred.xai || null,
      },
      observed: {
        latitude: lat,
        longitude: lon,
        brightness_temp_k: Number(obs.brightness_temp_k ?? obs.brightness ?? obs.bright_ti4 ?? obs.temp) || 320.0,
        frp_mw: frpMw,
        confidence_pct: Number(obs.confidence_pct ?? obs.confidence) || 70.0,
        acquisition_time: timestamp,
        satellite: obs.satellite || 'NOAA-20',
        instrument: obs.instrument || 'VIIRS',
        daynight: String(obs.daynight || 'D').toUpperCase(),
      },
      modeled_estimates: {
        flame_temperature_k: feat.estimated_emitter_temp_k,
        flame_area_m2: feat.estimated_emitter_area_m2,
        modeled_ndvi_proxy: feat.ndvi_val,
        is_ndvi_measured: Boolean(opticalMeta.optical_data_available),
        ndvi_provenance: opticalMeta.optical_data_available
          ? 'SENTINEL_2_L2A_SURFACE_REFLECTANCE'
          : 'DATA_UNAVAILABLE_OUTSIDE_TILE',
      },
      lulc_context: lulcMeta,
      optical_context: opticalMeta,
      xai: pred.xai || {
        method: 'TREE_SHAP',
        scope: 'LOCAL',
        decision_scope: 'STAGE_1_INDUSTRIAL_SEGREGATION',
        target_decision: 'Industrial vs Non-Industrial',
        algorithm: 'Exact Lundberg TreeSHAP dynamic-programming implementation',
        attributions: pred.feature_contributions || {},
      },
      derived_intelligence: {
        industrial_status: domainMapping.primary,
        classification: domainMapping.primary,
        subclassification: domainMapping.secondary,
        classification_confidence: rawConf,
        risk_level: domainMapping.riskLevel,
        guardrail_flags: pred.guardrail_flags ?? [],
        facility: meta.nearest_facility
          ? {
              name: meta.nearest_facility,
              distance_km: feat.dist_to_facility_km,
            }
          : null,
        land_cover: lulcMeta.dominant_class || meta.dominant_lulc,
        basis,
      },
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      timestamp,
    };
  }

  /**
   * Invokes ML model batch via worker process with dynamic timeout.
   */
  async _predictBatchViaWorker(detections) {
    if (!this.isReady || !this.process || this.process.killed) {
      throw new Error(this.initError || 'ML Worker process is not ready');
    }

    const id = crypto.randomUUID();
    const payload = JSON.stringify({ id, action: 'batch', detections }) + '\n';
    const timeoutMs = Math.max(this.requestTimeoutMs, 5000 + detections.length * 150);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`ML batch inference timed out after ${timeoutMs}ms (${detections.length} items)`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.process.stdin.write(payload);
    });
  }

  /**
   * Classify a single detection with automatic worker recovery.
   */
  async classifyThermalEvent(detection, options = {}) {
    const forceRuleBased = options.forceRuleBased || false;

    // 1. Try ML model inference if enabled and not forced to rule-based
    if (this.enabled && !forceRuleBased) {
      if (this.state !== WorkerState.RECOVERING) {
        if (!this.isReady) {
          await this.ensureReady(1200);
        }

        if (this.isReady) {
          try {
            const mlResp = await this._predictViaWorker(detection);
            if (mlResp && mlResp.status === 'ok' && mlResp.prediction) {
              const pred = {
                ...mlResp.prediction,
                features: mlResp.features,
                metadata: mlResp.metadata,
              };
              return this._formatMlEvent(detection, pred, mlResp.model_version);
            }
          } catch (err) {
            console.warn('[MLInferenceService] ML prediction failed, using rule-based fallback:', err.message);
          }
        }
      }
    }

    // 2. Rule-Based Fallback with explicit recovery provenance
    const baselineEvent = defaultClassifierEngine.classifyEvent(detection);
    return {
      ...baselineEvent,
      inference_source: 'RULE_BASED_FALLBACK',
      is_ml_predicted: false,
      fallback_reason: this.state === WorkerState.RECOVERING ? 'ML_WORKER_RECOVERING' : (this.initError || (forceRuleBased ? 'FORCE_RULE_BASED_REQUEST' : 'ML_WORKER_UNAVAILABLE')),
      recovery_in_progress: this.state === WorkerState.RECOVERING || this.state === WorkerState.STARTING,
      worker_state: this.state,
      modeled_estimates: {
        flame_temperature_k: baselineEvent.derived_intelligence?.physical_inversion?.flame_temperature_k ?? null,
        flame_area_m2: baselineEvent.derived_intelligence?.physical_inversion?.flame_area_m2 ?? null,
        modeled_ndvi_proxy: baselineEvent.derived_intelligence?.ndvi ?? null,
        is_ndvi_measured: false,
        ndvi_provenance: 'ESTIMATED_REGIONAL_CLIMATOLOGY',
      },
    };
  }

  /**
   * Vectorized Batch classification with automatic recovery.
   */
  async classifyBatch(detections = [], options = {}) {
    if (!detections || detections.length === 0) {
      return { status: 'ok', count: 0, events: [] };
    }

    const forceRuleBased = options.forceRuleBased || false;

    if (!forceRuleBased) {
      if (this.state !== WorkerState.RECOVERING) {
        if (!this.isReady) {
          await this.ensureReady(1500);
        }

        if (this.isReady) {
          try {
            const batchResp = await this._predictBatchViaWorker(detections);
            if (batchResp && batchResp.status === 'ok' && Array.isArray(batchResp.predictions)) {
              const events = batchResp.predictions.map((p, idx) => {
                const detection = detections[idx] || detections[p.index] || {};
                return this._formatMlEvent(detection, p, batchResp.model_version);
              });
              return {
                status: 'ok',
                inference_engine: 'ML_HIERARCHICAL_ENSEMBLE',
                is_ml_predicted: true,
                count: events.length,
                events,
              };
            }
          } catch (err) {
            console.warn('[MLInferenceService] ML batch prediction failed, falling back to rule-based batch:', err.message);
          }
        }
      }
    }

    // Fallback: rule-based batch engine with explicit recovery provenance
    const baselineBatch = defaultClassifierEngine.classifyBatch(detections);
    const enrichedEvents = (baselineBatch.events || []).map((ev) => ({
      ...ev,
      inference_source: 'RULE_BASED_FALLBACK',
      is_ml_predicted: false,
      modeled_estimates: {
        flame_temperature_k: ev.derived_intelligence?.physical_inversion?.flame_temperature_k ?? null,
        flame_area_m2: ev.derived_intelligence?.physical_inversion?.flame_area_m2 ?? null,
        modeled_ndvi_proxy: ev.derived_intelligence?.ndvi ?? null,
        is_ndvi_measured: false,
        ndvi_provenance: 'ESTIMATED_REGIONAL_CLIMATOLOGY',
      },
    }));

    return {
      ...baselineBatch,
      status: 'ok',
      count: enrichedEvents.length,
      events: enrichedEvents,
      inference_engine: 'DETERMINISTIC_RULE_BASED_ENGINE',
      inference_source: 'RULE_BASED_FALLBACK',
      is_ml_predicted: false,
      fallback_reason: this.state === WorkerState.RECOVERING ? 'ML_WORKER_RECOVERING' : (this.initError || (forceRuleBased ? 'FORCE_RULE_BASED_REQUEST' : 'ML_WORKER_UNAVAILABLE')),
      recovery_in_progress: this.state === WorkerState.RECOVERING || this.state === WorkerState.STARTING,
      worker_state: this.state,
    };
  }

  shutdown() {
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.state = WorkerState.STOPPED;
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }
  }
}

export const defaultMLInferenceService = new MLInferenceService();
