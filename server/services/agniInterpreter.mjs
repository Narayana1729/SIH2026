/**
 * @module server/services/agniInterpreter
 * @description AGNI Voice & Tactical Natural Language Command Interpreter.
 *
 * Implements Google Gemini NLU interpretation with prompt injection defense,
 * conversational context merging, and a high-speed deterministic local semantic fallback parser.
 */

export const AGNI_INTENTS = {
  FILTER_THERMAL_EVENTS: 'FILTER_THERMAL_EVENTS',
  FILTER_THERMAL_ANOMALIES: 'FILTER_THERMAL_ANOMALIES',
  FILTER_SEVERITY: 'FILTER_SEVERITY',
  FILTER_CATEGORY: 'FILTER_CATEGORY',
  FILTER_STATE: 'FILTER_STATE',
  FILTER_SECTOR: 'FILTER_SECTOR',
  SEARCH: 'SEARCH',
  SEARCH_INCIDENTS: 'SEARCH_INCIDENTS',
  SELECT_INCIDENT: 'SELECT_INCIDENT',
  MAP_ACTION: 'MAP_ACTION',
  TOGGLE_LAYER: 'TOGGLE_LAYER',
  SHOW_LAYER: 'SHOW_LAYER',
  HIDE_LAYER: 'HIDE_LAYER',
  OPEN_XAI: 'OPEN_XAI',
  SHOW_RESPONDERS: 'SHOW_RESPONDERS',
  SHOW_HAZARD: 'SHOW_HAZARD',
  OPEN_DOSSIER: 'OPEN_DOSSIER',
  CLEAR_FILTERS: 'CLEAR_FILTERS',
  OPEN_SIMULATION_LAB: 'OPEN_SIMULATION_LAB',
  MULTI_STEP: 'MULTI_STEP',
  DISPATCH_PREVIEW: 'DISPATCH_PREVIEW',
  CONFIRM_ACTION: 'CONFIRM_ACTION',
  CANCEL_ACTION: 'CANCEL_ACTION',
  CLARIFICATION_REQUIRED: 'CLARIFICATION_REQUIRED',
  UNKNOWN: 'UNKNOWN'
};

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) (instructions|prompts)/i,
  /system prompt/i,
  /execute (code|script|shell|sql|command)/i,
  /drop table/i,
  /delete from/i,
  /eval\(/i,
  /javascript:/i,
  /<script/i,
  /output (api key|passwords?|secrets?)/i,
  /developer mode/i,
  /jailbreak/i,
  /disregard (all |any )?(safety|guidelines|rules|instructions)/i,
  /repeat (the )?(instructions|prompt) above/i,
  /bypass (all )?(restrictions|rules|filters)/i,
];

const INDIAN_STATES = [
  'Telangana', 'Andhra Pradesh', 'Gujarat', 'Maharashtra', 'Odisha',
  'Jharkhand', 'Chhattisgarh', 'Karnataka', 'Tamil Nadu', 'Rajasthan',
  'Madhya Pradesh', 'West Bengal', 'Punjab', 'Haryana', 'Assam'
];

export class AgniInterpreterService {
  constructor(options = {}) {
    this.geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || null;
    this.geminiModel = options.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  detectPromptInjection(text) {
    if (!text || typeof text !== 'string') return false;
    return INJECTION_PATTERNS.some(pattern => pattern.test(text));
  }

  async interpretCommand(request) {
    const startTime = performance.now();
    const transcript = (request?.transcript || '').trim();
    const context = request?.context || {};

    // 1. Prompt Injection & Security Defense Check
    if (this.detectPromptInjection(transcript)) {
      const latencyMs = Number((performance.now() - startTime).toFixed(2));
      return {
        command: {
          intent: AGNI_INTENTS.UNKNOWN,
          filters: {},
          confidence: 0.0,
          requiresConfirmation: false,
          entities: []
        },
        message: 'Command rejected due to unsupported or unsafe instructions.',
        executionLatencyMs: latencyMs,
        status: 'unsupported'
      };
    }

    // 2. Gemini API NLU Check (if API key available)
    if (this.geminiApiKey) {
      try {
        const geminiCmd = await this._callGeminiApi(transcript, context);
        if (geminiCmd) {
          const latencyMs = Number((performance.now() - startTime).toFixed(2));
          return this._buildResponse(geminiCmd, latencyMs, 'interpreted');
        }
      } catch (err) {
        console.warn('[AgniInterpreter] Gemini NLU fallback to local parser:', err.message);
      }
    }

    // 3. High-Speed Deterministic Local Semantic Parser
    const fallbackCmd = this.fallbackInterpret(transcript, context);
    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    return this._buildResponse(
      fallbackCmd,
      latencyMs,
      this.geminiApiKey ? 'fallback' : 'interpreted'
    );
  }

  async _callGeminiApi(transcript, context) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
    const payload = {
      contents: [{
        parts: [{
          text: `You are AGNI, tactical voice AI for PyroSat / SIH thermal intelligence.
User command: "${transcript}"
Context: ${JSON.stringify(context || {})}
Output strictly JSON matching:
{
  "intent": "FILTER_THERMAL_EVENTS"|"MAP_ACTION"|"SELECT_INCIDENT"|"TOGGLE_LAYER"|"OPEN_XAI"|"SHOW_RESPONDERS"|"SHOW_HAZARD"|"OPEN_DOSSIER"|"CLEAR_FILTERS"|"OPEN_SIMULATION_LAB"|"MULTI_STEP"|"DISPATCH_PREVIEW"|"CANCEL_ACTION"|"CLARIFICATION_REQUIRED"|"UNKNOWN",
  "filters": {
    "classification": "INDUSTRIAL"|"NON_INDUSTRIAL"|null,
    "priority": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|null,
    "category": "industrial"|"wildfire"|"crop"|"coal"|"routine"|"accidental"|null,
    "state": string|null,
    "sector": string|null,
    "timeRange": "1h"|"6h"|"24h"|"48h"|"7d"|null,
    "searchQuery": string|null
  },
  "mapAction": "RECENTER_INDIA"|"SET_BASEMAP"|"SET_VIEW_MODE"|"ZOOM_IN"|"ZOOM_OUT"|null,
  "basemap": "satellite"|"dark"|"osm"|null,
  "viewMode": "2D"|"3D"|null,
  "layerId": string|null,
  "enabled": boolean|null,
  "selectedEventId": string|null,
  "targetCriterion": "most_severe"|"highest_frp"|"nearest"|null,
  "confidence": number,
  "response": string
}`
        }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  }

  fallbackInterpret(transcript, context = {}) {
    const lowered = (transcript || '').toLowerCase().trim();

    // A. Stop / Cancel commands
    if (['stop', 'cancel', 'halt', 'stop listening', 'abort', 'quiet'].includes(lowered)) {
      return {
        intent: AGNI_INTENTS.CANCEL_ACTION,
        filters: {},
        confidence: 0.99,
        requiresConfirmation: false,
        response: 'Command cancelled. Returning to idle.',
        entities: ['cancel'],
        executionTrace: ['Operation → Cancelled']
      };
    }

    // B. Emergency Notification / Dispatch
    if (['notify the nearest fire station', 'trigger emergency dispatch', 'dispatch responder',
         'send emergency alert', 'notify fire brigade', 'dispatch emergency', 'send sms alert'].some(w => lowered.includes(w))) {
      return {
        intent: AGNI_INTENTS.DISPATCH_PREVIEW,
        filters: {},
        confidence: 0.95,
        requiresConfirmation: true,
        isConsequential: true,
        response: 'This will initiate an emergency notification workflow for the selected incident. Do you want me to proceed?',
        entities: ['emergency_dispatch'],
        executionTrace: ['Action → Consequential Dispatch Preview', 'State → Awaiting Confirmation']
      };
    }

    // C. Clear / Reset commands
    const isClear = lowered.includes('clear') || lowered.includes('reset') || lowered.includes('remove all') ||
      ['show all', 'show everything', 'show all incidents', 'show all events'].includes(lowered);
    if (isClear && !['industr', 'refiner', 'critical', 'wildfire', 'telangana'].some(w => lowered.includes(w))) {
      return {
        intent: AGNI_INTENTS.CLEAR_FILTERS,
        filters: {},
        confidence: 0.98,
        requiresConfirmation: false,
        response: 'All filters cleared. Displaying full operational catalog.',
        entities: ['all'],
        executionTrace: ['Filters → Cleared', 'Catalog → Restored Full View']
      };
    }

    // D. Ambiguity requiring clarification
    if (lowered.includes('near the city') || lowered.includes('near a city')) {
      return {
        intent: AGNI_INTENTS.CLARIFICATION_REQUIRED,
        filters: {},
        confidence: 0.50,
        requiresConfirmation: true,
        response: 'Which city should I use?',
        entities: ['ambiguous_city']
      };
    }

    // E. Multi-Step Compound Commands (evaluated before single intent actions)
    if ((lowered.includes('critical') || lowered.includes('severe') || lowered.includes('fires')) && lowered.includes('punjab') && (lowered.includes('plume') || lowered.includes('dispersion'))) {
      return {
        intent: AGNI_INTENTS.FILTER_THERMAL_EVENTS,
        action: 'FILTER_THERMAL_EVENTS',
        filters: { severity: 'CRITICAL', state: 'PUNJAB' },
        confidence: 0.96,
        requiresConfirmation: false,
        response: 'Filtering critical fires in Punjab and simulating atmospheric plume dispersion.',
        entities: ['CRITICAL', 'PUNJAB', 'PLUME_DISPERSION'],
        steps: [
          { intent: AGNI_INTENTS.SHOW_HAZARD, action: 'SHOW_HAZARD', hazard_type: 'PLUME_DISPERSION' }
        ],
        executionTrace: [
          'Filter → Critical Punjab Thermal Surges',
          'Hazard → Atmospheric Plume Dispersion'
        ]
      };
    }
    if (lowered.includes('industr') && lowered.includes('gujarat') && (lowered.includes('most severe') || lowered.includes('highest frp') || lowered.includes('zoom'))) {
      return {
        intent: AGNI_INTENTS.MULTI_STEP,
        filters: { classification: 'INDUSTRIAL', industrial: true, state: 'Gujarat' },
        confidence: 0.96,
        requiresConfirmation: false,
        response: 'Showing industrial thermal anomalies in Gujarat, focusing on the most severe incident, and displaying emergency responders.',
        entities: ['Gujarat', 'industrial', 'india-emergency-services'],
        steps: [
          { intent: AGNI_INTENTS.FILTER_THERMAL_EVENTS, filters: { classification: 'INDUSTRIAL', industrial: true, state: 'Gujarat' } },
          { intent: AGNI_INTENTS.SELECT_INCIDENT, targetCriterion: 'most_severe' },
          { intent: AGNI_INTENTS.SHOW_RESPONDERS, layerId: 'india-emergency-services', enabled: true }
        ],
        executionTrace: [
          'Filter → Gujarat Industrial Anomalies',
          'Target → Most Severe Incident Selected',
          'Layer → Emergency Responders Activated'
        ]
      };
    }

    // F. Context Binding & Relative Pronouns
    const contextSelectedId = context.selectedEventId || context.selectedHazardId || null;
    if (lowered.includes('its responders') || lowered.includes('responders near this incident')) {
      if (!contextSelectedId) {
        return {
          intent: AGNI_INTENTS.CLARIFICATION_REQUIRED,
          filters: {},
          confidence: 0.60,
          requiresConfirmation: true,
          response: 'Please select an incident first, or tell me which incident you want.',
          entities: ['missing_selected_incident']
        };
      }
      return {
        intent: AGNI_INTENTS.SHOW_RESPONDERS,
        selectedEventId: contextSelectedId,
        incidentId: contextSelectedId,
        confidence: 0.97,
        requiresConfirmation: false,
        response: `Displaying emergency responders nearest to incident ${contextSelectedId}.`,
        entities: [contextSelectedId, 'responders'],
        executionTrace: [`Incident → ${contextSelectedId}`, 'Layer → Nearest Responders']
      };
    }

    if (lowered.includes('dossier') || lowered.includes('incident report') || lowered.includes('iap pdf') || lowered.includes('action plan')) {
      return {
        intent: AGNI_INTENTS.OPEN_DOSSIER,
        selectedEventId: contextSelectedId,
        incidentId: contextSelectedId,
        confidence: 0.97,
        requiresConfirmation: false,
        response: `Opening tactical incident briefing dossier for ${contextSelectedId || 'selected incident'}.`,
        entities: [contextSelectedId, 'dossier'].filter(Boolean),
        executionTrace: [`Incident → ${contextSelectedId || 'Selected'}`, 'Briefing → Dossier Generated']
      };
    }

    if (lowered.includes('explain') || lowered.includes('xai') || lowered.includes('evidence') || lowered.includes('shap') || lowered.includes('why')) {
      return {
        intent: AGNI_INTENTS.OPEN_XAI,
        selectedEventId: contextSelectedId,
        incidentId: contextSelectedId,
        confidence: 0.97,
        requiresConfirmation: false,
        response: 'Opening Explainable AI evidence card and TreeSHAP attribution waterfall.',
        entities: ['xai', 'treeshap'],
        executionTrace: ['XAI → Attribution Panel Opened']
      };
    }

    if (lowered.includes('plume') || lowered.includes('hazard zone') || lowered.includes('dispersion') || lowered.includes('toxic cloud')) {
      return {
        intent: AGNI_INTENTS.SHOW_HAZARD,
        hazard_type: 'PLUME_DISPERSION',
        confidence: 0.96,
        requiresConfirmation: false,
        response: 'Displaying Gaussian atmospheric plume dispersion and hazard corridor.',
        entities: ['plume'],
        executionTrace: ['Physics → Atmospheric Dispersion Plume']
      };
    }

    if (lowered.includes('simulation') || lowered.includes('sim lab') || lowered.includes('what if') || lowered.includes('sandbox')) {
      return {
        intent: AGNI_INTENTS.OPEN_SIMULATION_LAB,
        filters: {},
        confidence: 0.96,
        requiresConfirmation: false,
        response: 'Opening AI What-If Incident Simulation Lab.',
        entities: ['simulation_lab'],
        executionTrace: ['Tools → AI Simulation Lab']
      };
    }

    // G. Map Viewport & Basemaps
    if (lowered.includes('satellite') && (lowered.includes('map') || lowered.includes('view') || lowered.includes('basemap'))) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'SET_BASEMAP',
        action: 'SET_BASEMAP',
        basemap: 'satellite',
        confidence: 0.96,
        requiresConfirmation: false,
        response: 'Satellite imagery basemap enabled.',
        entities: ['satellite'],
        executionTrace: ['Basemap → Satellite Imagery']
      };
    }
    if (lowered.includes('dark map') || lowered.includes('dark view')) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'SET_BASEMAP',
        action: 'SET_BASEMAP',
        basemap: 'dark',
        confidence: 0.96,
        requiresConfirmation: false,
        response: 'Dark cartographic basemap enabled.',
        entities: ['dark'],
        executionTrace: ['Basemap → Dark Cartography']
      };
    }
    if (lowered.includes('openstreetmap') || lowered.includes('osm') || lowered.includes('street map')) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'SET_BASEMAP',
        action: 'SET_BASEMAP',
        basemap: 'osm',
        confidence: 0.96,
        requiresConfirmation: false,
        response: 'OpenStreetMap basemap enabled.',
        entities: ['osm'],
        executionTrace: ['Basemap → OpenStreetMap']
      };
    }
    if (lowered.includes('recenter') || lowered.includes('india view') || lowered.includes('reset view')) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'RECENTER_INDIA',
        action: 'RECENTER_INDIA',
        confidence: 0.98,
        requiresConfirmation: false,
        response: 'Recentered map to India operational overview.',
        entities: ['recenter'],
        executionTrace: ['Map → Recentered to India Overview']
      };
    }
    if ((lowered.includes('3d') && (lowered.includes('switch') || lowered.includes('map') || lowered.includes('view') || lowered.includes('mode') || lowered.includes('globe'))) || lowered.includes('orbital view') || lowered.includes('globe view')) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'SET_VIEW_MODE',
        action: 'SET_VIEW_MODE',
        viewMode: '3D',
        confidence: 0.98,
        requiresConfirmation: false,
        response: '3D orbital globe view enabled.',
        entities: ['3D'],
        executionTrace: ['Mode → 3D Orbital Globe']
      };
    }
    if ((lowered.includes('2d') && (lowered.includes('switch') || lowered.includes('map') || lowered.includes('view') || lowered.includes('mode') || lowered.includes('flat'))) || lowered.includes('flat map')) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'SET_VIEW_MODE',
        action: 'SET_VIEW_MODE',
        viewMode: '2D',
        confidence: 0.98,
        requiresConfirmation: false,
        response: '2D planar cartography enabled.',
        entities: ['2D'],
        executionTrace: ['Mode → 2D Planar Map']
      };
    }
    if (lowered.includes('zoom in')) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'ZOOM_IN',
        action: 'ZOOM_IN',
        confidence: 0.95,
        response: 'Zooming in.',
        executionTrace: ['Map → Zoom In']
      };
    }
    if (lowered.includes('zoom out')) {
      return {
        intent: AGNI_INTENTS.MAP_ACTION,
        mapAction: 'ZOOM_OUT',
        action: 'ZOOM_OUT',
        confidence: 0.95,
        response: 'Zooming out.',
        executionTrace: ['Map → Zoom Out']
      };
    }

    // H. Layer Controls
    const isHide = lowered.includes('hide') || lowered.includes('turn off') || lowered.includes('disable');
    if (lowered.includes('gas pipeline') || lowered.includes('pipeline')) {
      return {
        intent: AGNI_INTENTS.TOGGLE_LAYER,
        layerId: 'gas_pipelines',
        enabled: !isHide,
        confidence: 0.96,
        response: `National Gas Pipeline grid ${!isHide ? 'displayed' : 'hidden'}.`,
        executionTrace: [`Layer → Gas Pipelines (${!isHide ? 'Visible' : 'Hidden'})`]
      };
    }
    if (lowered.includes('powergrid') || lowered.includes('transmission line') || lowered.includes('power line')) {
      return {
        intent: AGNI_INTENTS.TOGGLE_LAYER,
        layerId: 'transmission_lines',
        enabled: !isHide,
        confidence: 0.96,
        response: `High-voltage power transmission grid ${!isHide ? 'displayed' : 'hidden'}.`,
        executionTrace: [`Layer → Power Transmission (${!isHide ? 'Visible' : 'Hidden'})`]
      };
    }
    if (lowered.includes('mining basin') || lowered.includes('coalfield') || lowered.includes('coal mine')) {
      return {
        intent: AGNI_INTENTS.TOGGLE_LAYER,
        layerId: 'mining_basins',
        enabled: !isHide,
        confidence: 0.96,
        response: `Coal mining concession basins ${!isHide ? 'displayed' : 'hidden'}.`,
        executionTrace: [`Layer → Mining Basins (${!isHide ? 'Visible' : 'Hidden'})`]
      };
    }
    if (lowered.includes('forest reserve') || lowered.includes('sanctuary') || lowered.includes('national park') || lowered.includes('protected area')) {
      return {
        intent: AGNI_INTENTS.TOGGLE_LAYER,
        layerId: 'protected_areas',
        enabled: !isHide,
        confidence: 0.96,
        response: `Protected wilderness & forest reserves ${!isHide ? 'displayed' : 'hidden'}.`,
        executionTrace: [`Layer → Protected Areas (${!isHide ? 'Visible' : 'Hidden'})`]
      };
    }
    if (lowered.includes('responder') || lowered.includes('fire station') || lowered.includes('ndrf')) {
      return {
        intent: AGNI_INTENTS.TOGGLE_LAYER,
        layerId: 'india-emergency-services',
        enabled: !isHide,
        confidence: 0.95,
        response: `Emergency responders ${!isHide ? 'displayed' : 'hidden'}.`,
        executionTrace: [`Layer → Emergency Responders (${!isHide ? 'Visible' : 'Hidden'})`]
      };
    }

    // I. Incident Selection Target Heuristics
    if (lowered.includes('most severe') || lowered.includes('worst fire') || lowered.includes('biggest fire')) {
      return {
        intent: AGNI_INTENTS.SELECT_INCIDENT,
        targetCriterion: 'most_severe',
        confidence: 0.95,
        response: 'Selecting and zooming to the highest severity thermal incident.',
        executionTrace: ['Incident → Focus on Most Severe Target']
      };
    }
    if (lowered.includes('highest frp') || lowered.includes('highest power') || lowered.includes('peak frp')) {
      return {
        intent: AGNI_INTENTS.SELECT_INCIDENT,
        targetCriterion: 'highest_frp',
        confidence: 0.95,
        response: 'Selecting incident with peak Fire Radiative Power (FRP).',
        executionTrace: ['Incident → Focus on Peak FRP Hotspot']
      };
    }
    if (lowered.includes('jamnagar')) {
      return {
        intent: AGNI_INTENTS.SELECT_INCIDENT,
        filters: { searchQuery: 'Jamnagar' },
        confidence: 0.95,
        response: 'Focusing on Jamnagar Petrochemical Complex.',
        executionTrace: ['Target → Jamnagar Refinery']
      };
    }

    // J. Time Range Filter
    let detectedTime = null;
    if (lowered.includes('1 hour') || lowered.includes('last hour') || lowered.includes('1h')) detectedTime = '1h';
    else if (lowered.includes('6 hours') || lowered.includes('6h')) detectedTime = '6h';
    else if (lowered.includes('24 hours') || lowered.includes('today') || lowered.includes('24h')) detectedTime = '24h';
    else if (lowered.includes('48 hours') || lowered.includes('48h')) detectedTime = '48h';
    else if (lowered.includes('7 days') || lowered.includes('week') || lowered.includes('7d')) detectedTime = '7d';

    // K. Taxonomy, Category, Severity & State Filtering
    const isIndustrial = ['industr', 'factory', 'refinery', 'steel', 'petrochemical', 'smelter'].some(w => lowered.includes(w));
    const isWildfire = lowered.includes('wildfire') || lowered.includes('forest fire');
    const isCrop = lowered.includes('crop') || lowered.includes('stubble') || lowered.includes('paddy') || lowered.includes('farm');
    const isRoutine = lowered.includes('routine') || lowered.includes('flare');
    const isCoal = lowered.includes('coal') || lowered.includes('mine') || lowered.includes('mining');

    let detectedPriority = null;
    if (lowered.includes('critical') || lowered.includes('urgent')) detectedPriority = 'CRITICAL';
    else if (lowered.includes('high')) detectedPriority = 'HIGH';
    else if (lowered.includes('medium')) detectedPriority = 'MEDIUM';
    else if (lowered.includes('low')) detectedPriority = 'LOW';

    let detectedState = null;
    for (const state of INDIAN_STATES) {
      if (lowered.includes(state.toLowerCase())) {
        detectedState = state;
        break;
      }
    }

    let detectedCategory = null;
    if (isCoal) detectedCategory = 'coal_mining_fire';
    else if (isWildfire) detectedCategory = 'forest_wildfire';
    else if (isCrop) detectedCategory = 'crop_residue';
    else if (isIndustrial) detectedCategory = 'industrial_flaring';
    else if (isRoutine) detectedCategory = 'routine_flare';

    let detectedSector = null;
    if (lowered.includes('refinery') || lowered.includes('petrochemical')) detectedSector = 'Refinery & Petrochemicals';
    else if (lowered.includes('steel') || lowered.includes('iron')) detectedSector = 'Iron & Steel';
    else if (lowered.includes('mining') || lowered.includes('coal')) detectedSector = 'Coal Mining';

    if (isIndustrial || detectedCategory || detectedPriority || detectedState || detectedSector || detectedTime) {
      const classification = isIndustrial ? 'INDUSTRIAL' : (['forest_wildfire', 'crop_residue'].includes(detectedCategory) ? 'NON_INDUSTRIAL' : null);
      const parts = [];
      const trace = [];
      if (detectedTime) { parts.push(detectedTime); trace.push(`Time → ${detectedTime}`); }
      if (detectedPriority) { parts.push(`${detectedPriority} severity`); trace.push(`Severity → ${detectedPriority}`); }
      if (isIndustrial) { parts.push('industrial thermal anomalies'); trace.push('Category → Industrial'); }
      else if (detectedCategory) { parts.push(`${detectedCategory} anomalies`); trace.push(`Category → ${detectedCategory}`); }
      else { parts.push('thermal anomalies'); }
      if (detectedState) { parts.push(`in ${detectedState}`); trace.push(`Region → ${detectedState}`); }
      if (detectedSector) { parts.push(`(${detectedSector})`); trace.push(`Sector → ${detectedSector}`); }

      return {
        intent: AGNI_INTENTS.FILTER_THERMAL_EVENTS,
        filters: {
          classification,
          priority: detectedPriority,
          severity: detectedPriority || null,
          category: detectedCategory,
          state: detectedState ? detectedState.toUpperCase() : null,
          sector: detectedSector,
          timeRange: detectedTime,
          industrial: isIndustrial || null
        },
        confidence: 0.95,
        requiresConfirmation: false,
        response: `Showing ${parts.join(' ')}.`,
        entities: [classification, detectedPriority, detectedCategory, detectedState, detectedSector, detectedTime].filter(Boolean),
        executionTrace: trace
      };
    }

    // L. Search query
    const searchMatch = lowered.match(/(?:search for|find|search|near|focus on)\s+([a-z0-9\s]+)/i);
    if (searchMatch) {
      const q = searchMatch[1].trim();
      return {
        intent: AGNI_INTENTS.SEARCH,
        filters: { searchQuery: q },
        confidence: 0.92,
        requiresConfirmation: false,
        response: `Searching incidents matching "${q}".`,
        entities: [q],
        executionTrace: [`Search → ${q}`]
      };
    }

    // Fallback unknown
    return {
      intent: AGNI_INTENTS.UNKNOWN,
      filters: {},
      confidence: 0.3,
      requiresConfirmation: false,
      response: "I can help control the thermal intelligence dashboard. Try asking me to show incidents, change filters, focus the map, or display responders.",
      entities: []
    };
  }

  _buildResponse(command, latencyMs, status) {
    return {
      command,
      message: command.response || 'Command executed.',
      executionLatencyMs: latencyMs,
      status
    };
  }
}

export const agniInterpreterService = new AgniInterpreterService();

export function scanPromptInjection(text) {
  return agniInterpreterService.detectPromptInjection(text);
}

export function interpretAgniCommand(transcript, context = {}) {
  if (scanPromptInjection(transcript)) {
    return {
      action: 'SECURITY_REJECTED',
      intent: 'SECURITY_REJECTED',
      speech_response: 'Security violation detected: instruction rejected by system policy.',
      response: 'Security violation detected: instruction rejected by system policy.',
      confidence: 0.0,
      entities: []
    };
  }

  const rawCmd = agniInterpreterService.fallbackInterpret(transcript, context);
  
  // Normalize fields so tests and consumers have uniform access
  let action = rawCmd.intent || rawCmd.action;
  if (rawCmd.intent === AGNI_INTENTS.MAP_ACTION) {
    action = 'MAP_ACTION';
  } else if (rawCmd.intent === AGNI_INTENTS.TOGGLE_LAYER || rawCmd.intent === AGNI_INTENTS.SHOW_LAYER || rawCmd.intent === AGNI_INTENTS.HIDE_LAYER) {
    action = 'LAYER_TOGGLE';
  }

  const mapAction = rawCmd.mapAction || rawCmd.map_action || (rawCmd.action === 'RECENTER_INDIA' ? 'RECENTER_INDIA' : rawCmd.action);
  const layerAction = rawCmd.layer_action || (rawCmd.enabled === false || rawCmd.intent === AGNI_INTENTS.HIDE_LAYER || rawCmd.action === 'HIDE' ? 'HIDE' : 'SHOW');
  const hazardType = rawCmd.hazard_type || (rawCmd.intent === AGNI_INTENTS.SHOW_HAZARD ? 'PLUME_DISPERSION' : null);
  const layer = rawCmd.layer || rawCmd.layerId || null;
  const viewMode = rawCmd.viewMode || rawCmd.view_mode || null;
  const multiStep = rawCmd.steps ? rawCmd.steps.map(s => ({
    ...s,
    action: s.intent || s.action,
    hazard_type: s.hazard_type || (s.intent === AGNI_INTENTS.SHOW_HAZARD ? 'PLUME_DISPERSION' : null)
  })) : [];

  return {
    ...rawCmd,
    action,
    map_action: mapAction,
    layer,
    layer_action: layerAction,
    hazard_type: hazardType,
    view_mode: viewMode,
    speech_response: rawCmd.speech_response || rawCmd.response,
    multi_step_actions: multiStep,
    feedback: rawCmd.feedback || rawCmd.response
  };
}
