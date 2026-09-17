/**
 * @module intelligence/correlationEngine
 * @description Multi-Source Incident Correlation Engine for sriVision.
 * Implements the 3 approved core intelligence workflows:
 *   1. Wildfire Environmental Risk (FIRMS thermal anomaly + Wind vector + Rainfall + Vegetation)
 *   2. Forest Disturbance Pattern (Canopy spectral delta + Proximity to FIRMS hotspots)
 *   3. Seismic Event Severity (USGS Magnitude + Depth context)
 */

import { haversineDistanceKm } from '../environmental/forest/forestFireCorrelation.js';
import { createDataProvenance, SOURCE_TYPES } from '../core/provenance.js';

export class MultiSourceIncidentCorrelationEngine {
  /**
   * Scenario 1: Evaluates environmental wildfire risk and potential wind-influenced spread.
   *
   * @param {object} input
   * @param {object} input.fire - Active thermal anomaly ({ lat, lon, frp, confidence })
   * @param {object} [input.weather] - Live weather ({ wind_speed_10m, wind_direction_10m, relative_humidity_2m, precipitation })
   * @param {object} [input.vegetation] - Vegetation status ({ ndvi, vegetationClass })
   * @returns {object} Correlated Wildfire Risk Assessment
   */
  correlateWildfireRisk({ fire, weather = {}, vegetation = {} }) {
    const lat = Number(fire.lat ?? fire.latitude) || 0;
    const lon = Number(fire.lon ?? fire.longitude) || 0;
    const frp = Number(fire.frp) || 10;
    const confidence = Number(fire.confidence) || 0.5;

    const windSpeed = Number(weather.wind_speed_10m ?? weather.windSpeed) || 0;
    const windDirection = Number(weather.wind_direction_10m ?? weather.windDirection) || 0;
    const humidity = Number(weather.relative_humidity_2m ?? weather.humidity) || 50;
    const precip = Number(weather.precipitation ?? weather.rain) || 0;

    const ndvi = Number(vegetation.ndvi) || 0.5;

    // Multi-factor additive heuristic risk score
    let baseScore = 0.20;
    const factors = [];

    // 1. FRP Intensity
    if (frp >= 100) {
      baseScore += 0.25;
      factors.push({ factor: 'High Fire Radiative Power', impact: 'CRITICAL', value: `${frp.toFixed(1)} MW`, scoreDelta: +0.25 });
    } else if (frp >= 30) {
      baseScore += 0.15;
      factors.push({ factor: 'Moderate Fire Radiative Power', impact: 'HIGH', value: `${frp.toFixed(1)} MW`, scoreDelta: +0.15 });
    }

    // 2. Wind Influence
    if (windSpeed >= 25) {
      baseScore += 0.20;
      factors.push({ factor: 'High Atmospheric Wind Speed', impact: 'HIGH', value: `${windSpeed.toFixed(1)} km/h`, scoreDelta: +0.20 });
    } else if (windSpeed >= 12) {
      baseScore += 0.10;
      factors.push({ factor: 'Moderate Surface Wind', impact: 'MODERATE', value: `${windSpeed.toFixed(1)} km/h`, scoreDelta: +0.10 });
    }

    // 3. Humidity & Precipitation
    if (precip > 2.0) {
      baseScore -= 0.15;
      factors.push({ factor: 'Active Surface Precipitation', impact: 'PROTECTIVE', value: `${precip.toFixed(1)} mm`, scoreDelta: -0.15 });
    } else if (humidity < 25) {
      baseScore += 0.15;
      factors.push({ factor: 'Low Ambient Relative Humidity', impact: 'HIGH', value: `${humidity}%`, scoreDelta: +0.15 });
    }

    // 4. Fuel Presence (NDVI)
    if (ndvi >= 0.50) {
      baseScore += 0.10;
      factors.push({ factor: 'Dense Canopy Fuel Availability', impact: 'MODERATE', value: `${ndvi.toFixed(2)} NDVI`, scoreDelta: +0.10 });
    }

    const riskScore = Math.max(0.05, Math.min(0.98, Math.round(baseScore * 100) / 100));

    let severity = 'LOW';
    if (riskScore >= 0.75) severity = 'CRITICAL';
    else if (riskScore >= 0.50) severity = 'HIGH';
    else if (riskScore >= 0.30) severity = 'MODERATE';

    // Potential wind-influenced spread vector (Heuristic Environmental Indicator)
    // Downwind heading is opposite the direction the wind blows from
    const spreadHeadingDeg = (windDirection + 180) % 360;

    return {
      incident_type: 'WILDFIRE_ENVIRONMENTAL_RISK',
      location: { lat, lon },
      severity,
      risk_score: riskScore,
      confidence: Math.round(confidence * 100) / 100,
      potential_spread: {
        indicator_type: 'HEURISTIC_ENVIRONMENTAL_INDICATOR',
        wind_speed_kmh: windSpeed,
        wind_direction_deg: windDirection,
        potential_spread_heading_deg: spreadHeadingDeg,
        description: `Potential wind-influenced spread alignment toward ~${Math.round(spreadHeadingDeg)}° under ${windSpeed.toFixed(1)} km/h wind.`,
      },
      contributing_factors: factors,
      operator_action: severity === 'CRITICAL' || severity === 'HIGH'
        ? 'Ground verification recommended: Monitor downwind corridor for thermal expansion.'
        : 'Routine observation: Track trailing thermal detections.',
      provenance: createDataProvenance({
        source: 'sriVision Multi-Source Correlation Engine',
        sourceType: SOURCE_TYPES.RULE_BASED,
        processing: ['firms_weather_spatial_join', 'multi_factor_heuristic_scoring'],
        confidenceType: 'DETERMINISTIC_HEURISTIC_BASELINE',
        limitations: [
          'Potential spread heading is a simplified wind vector indicator, not a thermodynamic fire physics simulation.',
          'Local topography, fuel moisture dynamics, and firefighting suppression are not modeled.',
        ],
      }),
    };
  }

  /**
   * Scenario 2: Correlates forest canopy spectral change with active thermal anomalies.
   */
  correlateForestDisturbance({ forestZone, canopyChange, nearbyFires = [] }) {
    const lat = forestZone.coordinates?.[1] ?? 0;
    const lon = forestZone.coordinates?.[0] ?? 0;
    const deltaNdvi = canopyChange.deltaNdvi || 0;
    const fireCount = nearbyFires.length;

    let disturbanceType = 'STABLE_CANOPY';
    let severity = 'LOW';
    let confidence = 0.85;

    if (deltaNdvi <= -0.15 && fireCount >= 3) {
      disturbanceType = 'FIRE_CORRELATED_CANOPY_DISTURBANCE';
      severity = 'HIGH';
      confidence = 0.80;
    } else if (deltaNdvi <= -0.10) {
      disturbanceType = 'CANOPY_DEGRADATION_PATTERN';
      severity = 'MODERATE';
      confidence = 0.70;
    } else if (fireCount >= 5) {
      disturbanceType = 'ACTIVE_THERMAL_CLUSTER_IN_CANOPY';
      severity = 'MODERATE';
      confidence = 0.75;
    }

    const isAlert = deltaNdvi <= -0.10 || fireCount >= 3;

    return {
      alert_title: 'FOREST DISTURBANCE ALERT',
      incident_type: 'FOREST_DISTURBANCE_PATTERN',
      zone_name: forestZone.name || 'Monitored Forest Area',
      location: { lat, lon },
      severity,
      disturbance_type: disturbanceType,
      confidence: Math.round(confidence * 100),
      observed: {
        vegetation_decline_detected: deltaNdvi <= -0.05,
        delta_ndvi: deltaNdvi,
        canopy_reduction_observed: deltaNdvi <= -0.12,
        thermal_anomalies_count: fireCount,
        spatial_proximity_km: nearbyFires.length > 0 ? (nearbyFires[0].distanceKm || 2.1) : null,
      },
      assessment: 'Potential forest disturbance pattern. Verification Required.',
      signals_observed: [
        `Canopy index delta: ${deltaNdvi.toFixed(2)} ΔNDVI`,
        `Proximate thermal anomalies: ${fireCount} active detections`,
        `Historical baseline loss rate: ${forestZone.latest_metrics?.forest_loss_percent || 0}%`,
      ],
      contributing_factors: [
        `Canopy index delta: ${deltaNdvi.toFixed(2)} ΔNDVI`,
        `Proximate thermal anomalies: ${fireCount} active detections`,
        `Historical baseline loss rate: ${forestZone.latest_metrics?.forest_loss_percent || 0}%`,
      ],
      operator_action: severity === 'HIGH'
        ? 'High disturbance pattern: Review high-resolution optical imagery and deploy ranger patrol.'
        : 'Monitor quarterly vegetation index trajectory.',
      provenance: createDataProvenance({
        source: 'sriVision Forest Intelligence Engine',
        sourceType: SOURCE_TYPES.RULE_BASED,
        processing: ['spectral_change_classification', 'spatial_thermal_correlation'],
        confidenceType: 'HEURISTIC_CORRELATION',
        limitations: [
          'Classification identifies spatial-temporal co-occurrence of spectral drop and thermal anomalies.',
          'Ground verification is required before confirming illegal logging or slash-and-burn operations.',
        ],
      }),
    };
  }

  /**
   * Scenario 3: Evaluates seismic event severity based on USGS magnitude and focal depth.
   */
  correlateSeismicSeverity(earthquakeFeature) {
    const coords = earthquakeFeature.geometry?.coordinates || [0, 0, 10];
    const lon = coords[0];
    const lat = coords[1];
    const depthKm = coords[2];
    const props = earthquakeFeature.properties || {};
    const magnitude = Number(props.mag) || 0;
    const place = props.place || 'Unknown location';
    const timeMs = props.time || Date.now();

    // Shallow earthquakes (< 30km) produce significantly higher surface shaking
    const isShallow = depthKm < 30;

    let severity = 'LOW';
    if (magnitude >= 7.0) severity = 'CRITICAL';
    else if (magnitude >= 6.0 || (magnitude >= 5.5 && isShallow)) severity = 'HIGH';
    else if (magnitude >= 4.5) severity = 'MODERATE';

    return {
      incident_type: 'SEISMIC_EVENT',
      event_id: earthquakeFeature.id || `eq-${timeMs}`,
      location: { lat, lon, depth_km: depthKm },
      place,
      magnitude,
      severity,
      focal_depth_category: isShallow ? 'SHALLOW_CRUSTAL (<30 km)' : 'INTERMEDIATE_DEEP (>=30 km)',
      timestamp: new Date(timeMs).toISOString(),
      operator_action: severity === 'CRITICAL' || severity === 'HIGH'
        ? 'High seismic energy release: Review regional infrastructure and monitor secondary aftershock sequence.'
        : 'Informational seismic record: Log event and monitor fault trend.',
      provenance: createDataProvenance({
        source: 'USGS Earthquake Hazards Program',
        sourceType: SOURCE_TYPES.REAL_LIVE,
        observedAt: new Date(timeMs).toISOString(),
        processing: ['usgs_geojson_ingest', 'depth_magnitude_severity_classification'],
        confidenceType: 'SEISMOGRAPHIC_SENSOR_NETWORK',
        limitations: [
          'Severity classification is based on magnitude and hypocenter depth; actual local shaking intensity requires Shakemap MMI data.',
        ],
      }),
    };
  }
}

export const defaultCorrelationEngine = new MultiSourceIncidentCorrelationEngine();
