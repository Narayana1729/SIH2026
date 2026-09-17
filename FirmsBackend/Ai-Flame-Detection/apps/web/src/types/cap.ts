/**
 * Types for OASIS / ITU-T X.1303 Common Alerting Protocol (CAP) v1.2
 * Compliant with India National Disaster Management Authority (NDMA) Sachet architecture.
 */

export interface CapAlertInfo {
  category: 'Fire' | 'Safety' | 'Health' | 'Env' | 'Other';
  event: string;
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  certainty: 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';
  eventCode: string;
  headline: string;
  description: string;
  instruction: string;
  areaDesc: string;
  circleCoordinates: string; // "lat,lon radius_km"
  polygonCoordinates?: string; // "lat,lon lat,lon ..."
  contact: string;
  web: string;
}

export interface CapAlertDocument {
  identifier: string;
  sender: string;
  sent: string; // ISO 8601 UTC
  status: 'Actual' | 'Exercise' | 'System' | 'Test';
  msgType: 'Alert' | 'Update' | 'Cancel' | 'Ack';
  scope: 'Public' | 'Restricted' | 'Private';
  info: CapAlertInfo;
  rawXml: string;
}
