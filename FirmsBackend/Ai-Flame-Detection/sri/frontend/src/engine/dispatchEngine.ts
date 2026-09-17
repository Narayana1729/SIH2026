import type { EmergencyResponder } from '../types';

export const ASSUMED_RESPONSE_SPEED_KMH = 40.0; // Standard emergency tactical speed in urban/semi-urban India

/**
 * Haversine distance in kilometers between two [lon, lat] points
 */
export function haversineDistanceKm(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface DispatchRecommendation {
  responder: EmergencyResponder;
  distanceKm: number;
  distanceFormatted: string;
  estimatedEtaMinutes: number;
  etaFormatted: string;
  dispatchPriority: 'IMMEDIATE' | 'BACKUP' | 'STANDBY';
  routeCoordinates: [number, number][]; // [lon, lat] pairs from responder to incident
}

export interface IncidentDispatchSummary {
  incidentId: string;
  nearestFireStation: DispatchRecommendation | null;
  nearestHospital: DispatchRecommendation | null;
  nearestNdrf: DispatchRecommendation | null;
  totalRespondersInRange: number;
}

export function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return '0 m';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function formatEta(etaMinutes: number): string {
  if (!Number.isFinite(etaMinutes) || etaMinutes <= 0) return '< 1 min';
  if (etaMinutes < 1) return '< 1 min';
  if (etaMinutes < 60) return `${Math.round(etaMinutes)} min`;
  const hrs = Math.floor(etaMinutes / 60);
  const mins = Math.round(etaMinutes % 60);
  return `${hrs}h ${mins}m`;
}

export function calculateDispatchPlan(
  incidentLat: number,
  incidentLon: number,
  incidentId: string,
  responders: EmergencyResponder[]
): IncidentDispatchSummary {
  let nearestFire: DispatchRecommendation | null = null;
  let nearestHosp: DispatchRecommendation | null = null;
  let nearestNdrf: DispatchRecommendation | null = null;

  let minFireDist = Infinity;
  let minHospDist = Infinity;
  let minNdrfDist = Infinity;
  let inRangeCount = 0;

  responders.forEach((resp) => {
    const distKm = haversineDistanceKm([resp.lon, resp.lat], [incidentLon, incidentLat]);
    if (distKm <= 100) inRangeCount++;

    const etaMin = Number(((distKm / ASSUMED_RESPONSE_SPEED_KMH) * 60).toFixed(1));
    const rec: DispatchRecommendation = {
      responder: resp,
      distanceKm: Number(distKm.toFixed(2)),
      distanceFormatted: formatDistance(distKm),
      estimatedEtaMinutes: etaMin,
      etaFormatted: formatEta(etaMin),
      dispatchPriority: distKm < 15 ? 'IMMEDIATE' : distKm < 40 ? 'BACKUP' : 'STANDBY',
      routeCoordinates: [
        [resp.lon, resp.lat],
        [incidentLon, incidentLat],
      ],
    };

    if (resp.type === 'fire_station' && distKm < minFireDist) {
      minFireDist = distKm;
      nearestFire = rec;
    } else if (resp.type === 'hospital' && distKm < minHospDist) {
      minHospDist = distKm;
      nearestHosp = rec;
    } else if (resp.type === 'ndrf' && distKm < minNdrfDist) {
      minNdrfDist = distKm;
      nearestNdrf = rec;
    }
  });

  return {
    incidentId,
    nearestFireStation: nearestFire,
    nearestHospital: nearestHosp,
    nearestNdrf,
    totalRespondersInRange: inRangeCount,
  };
}
