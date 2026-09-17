/**
 * @module disasters/weather/weatherMath
 * @description Meteorological math utilities: Beaufort scale, wind heading vectors, and WMO weather codes.
 */

export function parseWmoWeatherCode(code) {
  const c = Number(code) || 0;
  if (c === 0) return { label: 'Clear Sky', category: 'CLEAR' };
  if (c <= 3) return { label: 'Partly Cloudy', category: 'CLOUDS' };
  if (c <= 48) return { label: 'Fog / Mist', category: 'FOG' };
  if (c <= 57) return { label: 'Drizzle', category: 'RAIN' };
  if (c <= 67) return { label: 'Rain', category: 'RAIN' };
  if (c <= 77) return { label: 'Snowfall', category: 'SNOW' };
  if (c <= 82) return { label: 'Rain Showers', category: 'RAIN' };
  if (c <= 86) return { label: 'Snow Showers', category: 'SNOW' };
  if (c <= 99) return { label: 'Thunderstorm', category: 'STORM' };
  return { label: 'Unknown Weather', category: 'CLEAR' };
}

export function windSpeedToBeaufort(kmh) {
  const speed = Number(kmh) || 0;
  if (speed < 1) return { scale: 0, description: 'Calm' };
  if (speed < 6) return { scale: 1, description: 'Light air' };
  if (speed < 12) return { scale: 2, description: 'Light breeze' };
  if (speed < 20) return { scale: 3, description: 'Gentle breeze' };
  if (speed < 29) return { scale: 4, description: 'Moderate breeze' };
  if (speed < 39) return { scale: 5, description: 'Fresh breeze' };
  if (speed < 50) return { scale: 6, description: 'Strong breeze' };
  if (speed < 62) return { scale: 7, description: 'Near gale' };
  if (speed < 75) return { scale: 8, description: 'Gale' };
  return { scale: 9, description: 'Severe gale / Storm' };
}
