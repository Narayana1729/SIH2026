/**
 * @module server/routes/weather
 * @description Open-Meteo weather observation and atmospheric proxy for sriVision.
 */

import { defaultCache } from '../services/cache.mjs';
import { createRateLimiter } from '../services/rateLimit.mjs';
import { sendJson, getClientIp } from '../middleware/security.mjs';

const rateLimiter = createRateLimiter({ maxTokens: 120, refillIntervalMs: 60000 });
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function handleWeatherRoute(req, res, url) {
  const lat = Number(url.searchParams.get('lat') || '0');
  const lon = Number(url.searchParams.get('lon') || '0');

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return sendJson(res, 400, { error: 'Invalid lat/lon coordinates' });
  }

  // Rounded grid cache key (approx 10km grid)
  const gridLat = Math.round(lat * 10) / 10;
  const gridLon = Math.round(lon * 10) / 10;
  const cacheKey = `weather_${gridLat}_${gridLon}.json`;

  const now = Date.now();
  const diskCached = await defaultCache.get(cacheKey);
  if (diskCached) {
    try {
      const parsed = JSON.parse(diskCached);
      const ageSec = Math.round((now - parsed.timestamp) / 1000);
      if (now - parsed.timestamp < CACHE_TTL_MS) {
        return sendJson(res, 200, {
          ...parsed,
          source: 'CACHE',
          is_live: false,
          is_fallback: false,
          is_measured: true,
          cache_age_seconds: ageSec,
          data_quality: 'CACHED_RECENT',
        }, { 'X-Cache': 'HIT-DISK' });
      }
    } catch {}
  }

  const upstreamUrl = `https://api.open-meteo.com/v1/forecast?latitude=${gridLat}&longitude=${gridLon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=precipitation_probability,precipitation&timezone=auto`;

  try {
    const response = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'sriVision/1.0 (Disaster-Command-Platform)' },
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const weatherData = await response.json();
      const payload = {
        status: 'ok',
        source: 'LIVE',
        provider: 'Open-Meteo Atmospheric Model',
        is_live: true,
        is_fallback: false,
        is_measured: true,
        location: { lat: gridLat, lon: gridLon },
        current: weatherData.current || {},
        units: weatherData.current_units || {},
        timestamp: now,
      };

      await defaultCache.set(cacheKey, JSON.stringify(payload));
      return sendJson(res, 200, payload, { 'X-Cache': 'MISS' });
    }
  } catch (err) {
    console.warn('[sriVision weather] Upstream Open-Meteo fetch failed:', err.message);
  }

  if (diskCached) {
    try {
      const parsed = JSON.parse(diskCached);
      const ageSec = Math.round((now - parsed.timestamp) / 1000);
      return sendJson(res, 200, {
        ...parsed,
        source: 'CACHE',
        is_live: false,
        is_fallback: false,
        is_measured: true,
        cache_age_seconds: ageSec,
        data_quality: 'CACHED_STALE',
        warning: 'Displaying cached weather from earlier pass due to upstream delay.',
      }, { 'X-Cache': 'STALE' });
    } catch {}
  }

  return sendJson(res, 200, {
    status: 'degraded',
    source: 'FALLBACK',
    provider: 'Climatological Regional Default (Open-Meteo Proxy)',
    is_live: false,
    is_fallback: true,
    is_measured: false,
    data_provenance: 'ESTIMATED_REGIONAL_CLIMATOLOGY',
    warning: 'Upstream meteorological API unreachable. Displaying standard baseline climatology (20°C, 50% RH, 5 m/s wind).',
    location: { lat: gridLat, lon: gridLon },
    current: {
      temperature_2m: 20.0,
      relative_humidity_2m: 50,
      precipitation: 0.0,
      wind_speed_10m: 5.0,
      wind_direction_10m: 0,
      cloud_cover: 10,
    },
    timestamp: now,
  });
}
