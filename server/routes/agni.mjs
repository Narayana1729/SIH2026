/**
 * @module server/routes/agni
 * @description API route handler for AGNI Tactical Voice Intelligence Assistant.
 */

import { agniInterpreterService, AGNI_INTENTS } from '../services/agniInterpreter.mjs';
import { sendJson, sendError } from '../middleware/security.mjs';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function handleAgniRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/(?:v1\/)?agni/, '');

  // 1. Interpret Voice Command: POST /api/v1/agni/interpret or /interpret
  if (pathname === '/interpret' || pathname === '') {
    if (req.method !== 'POST') {
      return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'POST method required for interpretation.', [], req);
    }

    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (err) {
      return sendError(res, 400, 'INVALID_JSON', 'Malformed JSON payload.', [], req);
    }

    const transcript = typeof payload.transcript === 'string' ? payload.transcript.trim() : '';
    if (!transcript) {
      return sendError(res, 400, 'MISSING_TRANSCRIPT', 'Field transcript is required.', [], req);
    }

    try {
      const response = await agniInterpreterService.interpretCommand({
        transcript,
        context: payload.context || {}
      });

      const structured = {
        ...response.command,
        action: response.command.intent || response.command.action,
        speech_response: response.command.response || response.message,
        message: response.message,
        status: response.status,
        executionLatencyMs: response.executionLatencyMs
      };

      return sendJson(res, 200, {
        success: true,
        data: structured,
        ...response
      }, { 'Cache-Control': 'no-store' }, req);
    } catch (err) {
      console.error('[AgniRoute] Command interpretation error:', err);
      return sendError(res, 500, 'INTERPRETATION_ERROR', 'Internal voice interpretation failure.', [], req);
    }
  }

  // 2. Capabilities & Intents Catalog: GET /api/v1/agni/capabilities
  if (pathname === '/capabilities') {
    return sendJson(res, 200, {
      status: 'ok',
      success: true,
      service: 'AGNI Tactical Voice AI',
      intents: Object.values(AGNI_INTENTS),
      capabilities: [
        'speech_recognition_stt',
        'voice_synthesis_tts',
        'audio_spectrum_visualizer',
        'prompt_injection_defense',
        'deterministic_nlu_fallback',
        'multi_step_compound_commands'
      ],
      sample_commands: [
        'Show industrial fires in Gujarat',
        'Show all thermal anomalies',
        'Select the most severe incident',
        'Simulate atmospheric dispersion plume',
        'Explain why this fire was classified as industrial',
        'Show emergency responders near this incident',
        'Toggle national gas pipelines layer',
        'Open What-If Simulation Lab',
        'Recenter map to India',
        'Switch to satellite view'
      ]
    }, { 'Cache-Control': 'public, max-age=3600' }, req);
  }

  return sendError(res, 404, 'ROUTE_NOT_FOUND', `AGNI route endpoint not found: ${pathname}`, [], req);
}
