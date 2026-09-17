/**
 * OASIS / ITU-T X.1303 Common Alerting Protocol (CAP) v1.2 Serializer.
 * 
 * Generates official XML payloads compliant with NDMA Sachet and State Emergency 
 * Operation Centre (SEOC) telecommunication relays.
 */

import type { ThermalEvent } from '../../types/event.ts';
import type { RiskAssessment } from '../../types/risk.ts';
import type { PopulationExposureResult } from '../../types/exposure.ts';
import type { IncidentEvolution } from '../../types/evolution.ts';
import type { CapAlertDocument, CapAlertInfo } from '../../types/cap.ts';

export interface GenerateCapOptions {
  risk?: RiskAssessment | null;
  exposure?: PopulationExposureResult | null;
  evolution?: IncidentEvolution | null;
  status?: 'Actual' | 'Exercise' | 'Test';
}

/**
 * Serializes an incident into an OASIS CAP v1.2 XML document.
 */
export function generateCapAlert(
  event: ThermalEvent,
  options?: GenerateCapOptions
): CapAlertDocument {
  const status = options?.status ?? 'Actual';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const cleanId = event.event_id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  const identifier = `IN-NDMA-PYROSAT-${dateStr}-${cleanId}`;
  const sender = 'pyrosat-ops@sih26162.ndma.gov.in';
  const sent = now.toISOString();

  // Map risk and trajectory to CAP severity and urgency
  const isCritical = options?.risk?.level === 'CRITICAL';
  const isHigh = options?.risk?.level === 'HIGH';
  const isEscalating = options?.evolution?.trajectory === 'ESCALATING';

  let severity: CapAlertInfo['severity'] = 'Moderate';
  let urgency: CapAlertInfo['urgency'] = 'Expected';
  let certainty: CapAlertInfo['certainty'] = 'Observed';

  if (isCritical || isEscalating) {
    severity = 'Extreme';
    urgency = 'Immediate';
  } else if (isHigh) {
    severity = 'Severe';
    urgency = 'Immediate';
  } else if (event.uncertainty_state === 'REVIEW_REQUIRED') {
    certainty = 'Possible';
    urgency = 'Future';
  }

  const category: CapAlertInfo['category'] = event.classification === 'INDUSTRIAL' ? 'Safety' : 'Fire';
  const protocolCode = options?.risk?.actionRecommendation?.protocolCode ?? 'DIS-TAC-LEVEL-2';

  // Construct headline
  const eventName = event.classification === 'INDUSTRIAL' ? 'High-Intensity Industrial Flare Anomaly' : 'Active Vegetation Wildfire';
  const headline = `[${severity.toUpperCase()} ALERT] ${eventName} - ${event.location_name || 'Thermal Hotspot'}`;

  // Construct description
  const frpStr = `${event.frp_mw.toFixed(1)} MW`;
  const exposedPopStr = options?.exposure ? `Estimated exposed population downwind: ${options.exposure.exposedPopulationEstimate.toLocaleString()} residents across ${options.exposure.plumeAreaKm2.toFixed(1)} km².` : '';
  const trajectoryStr = options?.evolution ? `Incident trajectory: ${options.evolution.trajectory} (Radiant power change: ${options.evolution.frpGrowthRateMwPerHr > 0 ? '+' : ''}${options.evolution.frpGrowthRateMwPerHr} MW/h).` : '';
  
  const description = `Multi-satellite radiometric detection confirmed active thermal anomaly (${frpStr}) at latitude ${event.latitude.toFixed(4)}, longitude ${event.longitude.toFixed(4)}. ${trajectoryStr} ${exposedPopStr} Dispatched Protocol: ${protocolCode}.`;

  // Construct civil defense instruction
  const instruction = options?.risk?.actionRecommendation?.primaryAction ?? 
    'Emergency responders must verify wind direction and secure isolation perimeter according to NDMA Standard Operating Procedures. Downwind sensitive populations should close windows and limit outdoor exertion.';

  const areaDesc = event.location_name || `Coordinate ${event.latitude.toFixed(3)}N, ${event.longitude.toFixed(3)}E`;
  const radiusKm = options?.exposure ? Math.max(1.5, Math.min(15.0, Math.sqrt(options.exposure.plumeAreaKm2 / Math.PI) * 1.5)).toFixed(1) : '3.0';
  const circleCoordinates = `${event.latitude.toFixed(4)},${event.longitude.toFixed(4)} ${radiusKm}`;

  const info: CapAlertInfo = {
    category,
    event: eventName,
    urgency,
    severity,
    certainty,
    eventCode: protocolCode,
    headline,
    description,
    instruction,
    areaDesc,
    circleCoordinates,
    contact: 'State Emergency Operations Centre (SEOC) Control Room 1070 / Fire 101',
    web: `https://pyrosat.ndma.gov.in/events/${event.event_id}`
  };

  // Generate XML
  const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${identifier}</identifier>
  <sender>${sender}</sender>
  <sent>${sent}</sent>
  <status>${status}</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>${info.category}</category>
    <event>${escapeXml(info.event)}</event>
    <urgency>${info.urgency}</urgency>
    <severity>${info.severity}</severity>
    <certainty>${info.certainty}</certainty>
    <eventCode>
      <valueName>NDMA_PROTOCOL</valueName>
      <value>${info.eventCode}</value>
    </eventCode>
    <headline>${escapeXml(info.headline)}</headline>
    <description>${escapeXml(info.description)}</description>
    <instruction>${escapeXml(info.instruction)}</instruction>
    <web>${info.web}</web>
    <contact>${escapeXml(info.contact)}</contact>
    <area>
      <areaDesc>${escapeXml(info.areaDesc)}</areaDesc>
      <circle>${info.circleCoordinates}</circle>
    </area>
  </info>
</alert>`.trim();

  return {
    identifier,
    sender,
    sent,
    status,
    msgType: 'Alert',
    scope: 'Public',
    info,
    rawXml
  };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
