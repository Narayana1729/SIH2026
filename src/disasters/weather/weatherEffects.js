/**
 * @module disasters/weather/weatherEffects
 * @description Weather overlay manager fetching live atmospheric observations from Open-Meteo.
 */

import { parseWmoWeatherCode, windSpeedToBeaufort } from './weatherMath.js';

export class WeatherLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.currentWeather = null;
    this.visible = true;
  }

  async fetchWeatherForLocation(lat, lon) {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.currentWeather = data;
      return this.currentWeather;
    } catch (err) {
      console.warn('[sriVision Weather] Error loading weather:', err);
      return null;
    }
  }

  getWeatherSummary() {
    if (!this.currentWeather?.current) return null;
    const cur = this.currentWeather.current;
    const wmo = parseWmoWeatherCode(cur.weather_code);
    const beaufort = windSpeedToBeaufort(cur.wind_speed_10m);

    return {
      condition: wmo.label,
      category: wmo.category,
      temperatureC: cur.temperature_2m,
      humidityPercent: cur.relative_humidity_2m,
      windSpeedKmh: cur.wind_speed_10m,
      windDirectionDeg: cur.wind_direction_10m,
      windBeaufort: beaufort.description,
      precipitationMm: cur.precipitation || 0,
    };
  }

  setVisible(visible) {
    this.visible = visible;
  }
}
