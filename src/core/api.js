/**
 * @module core/api
 * @description Centralized, resilient HTTP client for all sriVision /api/* endpoints.
 * Handles timeouts, AbortController cancellations, retry policies, and error normalization.
 */

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;

/**
 * Execute a guarded fetch request with timeout and automatic retry.
 */
async function request(endpoint, options = {}, retries = MAX_RETRIES) {
  const url = endpoint.startsWith('http') ? endpoint : endpoint;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        const retryAfterSec = parseInt(response.headers.get('Retry-After') || '2', 10);
        await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
        return request(endpoint, options, retries - 1);
      }
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${endpoint}`);
    }
    if (retries > 0 && !endpoint.includes('dossier')) {
      await new Promise((r) => setTimeout(r, 1000));
      return request(endpoint, options, retries - 1);
    }
    throw err;
  }
}

export const sriVisionApi = {
  // 1. Wildfires & FIRMS
  async getFirmsHotspots(bbox = '68,6,97,37', days = 1, date = null) {
    let url = `/api/firms?bbox=${encodeURIComponent(bbox)}&days=${days}`;
    if (date) url += `&date=${encodeURIComponent(date)}`;
    return request(url);
  },

  async getTimelineStats(year = 2026, month = 8) {
    return request(`/api/v1/firms/timeline?year=${year}&month=${month}`);
  },

  async simulateFireSpread(params) {
    return request('/api/simulation/spread', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // 2. Industrial HazMat GIS & Emergency Responders
  async getIndustrialFacilities(limit = 300) {
    return request(`/api/industrial/facilities?limit=${limit}`);
  },

  async getNearbyIndustrial(lat, lon, radiusKm = 30) {
    return request(`/api/industrial/nearby?lat=${lat}&lon=${lon}&radiusKm=${radiusKm}`);
  },

  async getNearbyResponders(lat, lon, radiusKm = 40) {
    return request(`/api/responders/nearby?lat=${lat}&lon=${lon}&radiusKm=${radiusKm}`);
  },

  // 3. Chemical Plume Dispersion & Live Weather
  async getWeather(lat, lon) {
    return request(`/api/weather?lat=${lat}&lon=${lon}`);
  },

  async simulatePlume(params) {
    return request('/api/dispersion/plume', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // 4. Landslides & Slope Digital Twins
  async getSentinelSlopes() {
    return request('/api/landslide/sentinel-slopes');
  },

  async getSlopeTwin(slopeId) {
    return request(`/api/landslide/slope-twin/${encodeURIComponent(slopeId)}`);
  },

  async getSlopeTwinHistory(slopeId) {
    return request(`/api/landslide/slope-twin/${encodeURIComponent(slopeId)}/history`);
  },

  async simulateSlopeStress(params) {
    return request('/api/landslide/simulate-stress', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getLandslideVillageRisks() {
    return request('/api/landslide/village-risk');
  },

  async assessLandslide(params) {
    return request('/api/landslide/assess', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // 5. Flash Floods
  async getFlashFloodVillageRisks() {
    return request('/api/flood/village-risk');
  },

  async assessFlashFlood(params) {
    return request('/api/flood/assess-flash-flood', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // 6. Tactical Dossier
  async generateTacticalDossier(incidentContext) {
    return request('/api/dossier/generate', {
      method: 'POST',
      body: JSON.stringify(incidentContext),
    });
  },

  // 7. Earthquakes & Weather
  async getEarthquakes() {
    return request('/api/earthquakes');
  },

  async getWeather(lat, lon) {
    return request(`/api/weather?lat=${lat}&lon=${lon}`);
  },
};
