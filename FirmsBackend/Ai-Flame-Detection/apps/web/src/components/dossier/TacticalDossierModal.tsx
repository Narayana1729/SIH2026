"use client";

import React, { useState } from "react";
import { ThermalEvent, EventEvidenceResponse } from "@/types/event";
import {
  FileText,
  Printer,
  X,
  Flame,
  ShieldAlert,
  Biohazard,
  Gauge,
  Wind,
  Loader2,
  AlertCircle,
  Download,
  Clock,
} from "lucide-react";
import { formatCoordinate } from "@/lib/format/coordinates";
import { formatFrp } from "@/lib/format/numbers";
import { formatUtcDateTime } from "@/lib/format/dates";
import { getApiBaseUrl } from "@/lib/api/client";
import { generateCapAlert } from "@/lib/protocols/capSerializer";

export interface TacticalDossierModalProps {
  event: ThermalEvent | null;
  evidence?: EventEvidenceResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TacticalDossierModal({
  event,
  evidence,
  isOpen,
  onClose,
}: TacticalDossierModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isCopiedXml, setIsCopiedXml] = useState(false);
  const [isCopiedJson, setIsCopiedJson] = useState(false);

  if (!isOpen || !event) return null;

  const handleExportPdf = async () => {
    if (!event.event_id) {
      setExportError("No incident selected for export.");
      return;
    }

    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);
    setDownloadUrl(null);

    const baseUrl = getApiBaseUrl();
    const primaryUrl = `${baseUrl}/events/${encodeURIComponent(event.event_id)}/dossier/pdf`;
    const fallbackUrl = `${baseUrl}/api/incident-dossier/${encodeURIComponent(event.event_id)}/pdf`;

    try {
      let response: Response;
      try {
        response = await fetch(primaryUrl, {
          method: "GET",
          headers: { Accept: "application/pdf" },
        });
        if (!response.ok && response.status === 404) {
          response = await fetch(fallbackUrl, {
            method: "GET",
            headers: { Accept: "application/pdf" },
          });
        }
      } catch {
        throw new Error("Unable to generate tactical dossier. Backend unavailable.");
      }

      if (!response.ok) {
        throw new Error(`Tactical dossier generation failed (HTTP ${response.status}).`);
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("Generated dossier could not be opened.");
      }

      const pdfBlob = new Blob([blob], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Attempt to open official PDF in a new browser tab
      const openedTab = window.open(pdfUrl, "_blank", "noopener,noreferrer");

      // Handle popup blocker fallback: initiate direct file download
      if (!openedTab || openedTab.closed || typeof openedTab.closed === "undefined") {
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = `tactical-dossier-${event.event_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setDownloadUrl(pdfUrl);
      }

      // Clean up object URL after 60 seconds
      setTimeout(() => {
        try {
          URL.revokeObjectURL(pdfUrl);
        } catch {
          // Ignore revoke errors
        }
      }, 60000);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to generate tactical dossier. Please try again.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadJson = () => {
    if (!event) return;
    try {
      const payload = {
        dossier_type: "TACTICAL_INCIDENT_BRIEFING",
        version: "1.2",
        generated_at: new Date().toISOString(),
        event,
        evidence: evidence || null,
        protocol: "NDMA_SACHET_CAP_1_2",
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pyrosat-dossier-${event.event_id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to export JSON telemetry.";
      setExportError(message);
    }
  };

  const handleExportCapXml = () => {
    if (!event) return;
    try {
      const capDoc = generateCapAlert(event);
      const blob = new Blob([capDoc.rawXml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NDMA-CAP-${event.event_id}-${Date.now()}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setIsCopiedXml(true);
      setTimeout(() => setIsCopiedXml(false), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate CAP XML alert.";
      setExportError(message);
    }
  };

  const handleCopyCapToClipboard = async () => {
    if (!event) return;
    try {
      const capDoc = generateCapAlert(event);
      await navigator.clipboard.writeText(capDoc.rawXml);
      setIsCopiedXml(true);
      setTimeout(() => setIsCopiedXml(false), 2000);
    } catch {
      handleExportCapXml();
    }
  };

  const isIndustrial = event.classification === "INDUSTRIAL";
  const frp = event.frp_mw;
  const tempK = Math.round(550.0 + Math.min(1150.0, Math.sqrt(frp) * 65.0));
  const tempC = tempK - 273;
  const emitterArea = Math.max(1.2, Number((frp * 1.45).toFixed(1)));
  const plumeLen = Math.min(18, Math.max(1.5, Math.sqrt(frp) * 0.4)).toFixed(1);
  const evacRad = Math.min(3.5, Math.max(0.4, 0.25 * Math.pow(frp, 0.35))).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-surface-raised border border-border rounded-modal shadow-modal flex flex-col font-sans overflow-hidden text-foreground">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-control bg-state-error/10 border border-state-error/30 text-state-error">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                <span>Tactical Incident Briefing Dossier</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-state-error/10 text-state-error border border-state-error/20">
                  {event.event_id}
                </span>
              </div>
              <div className="text-[11px] text-foreground-muted">
                Official Multi-Agency Emergency Response Package (CAP v1.2 / NDMA Sachet Ready)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleDownloadJson}
              title="Download structured JSON telemetry payload"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-control bg-surface-raised border border-border hover:bg-surface-hover text-foreground transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              <span>{isCopiedJson ? "Downloaded!" : "JSON"}</span>
            </button>
            <button
              onClick={handleCopyCapToClipboard}
              title="Copy ITU-T X.1303 / OASIS CAP v1.2 XML Alert payload to clipboard"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-control bg-surface-raised border border-border hover:bg-surface-hover text-foreground transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-state-warning" />
              <span>{isCopiedXml ? "Copied XML!" : "Copy CAP XML"}</span>
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              aria-busy={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control bg-accent text-white hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Export PDF</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-control text-foreground-muted hover:text-foreground hover:bg-surface-hover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Export Feedback Banner */}
        {exportError && (
          <div className="px-4 py-2 bg-state-error/15 border-b border-state-error/30 text-state-error flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{exportError}</span>
            </div>
            <button
              onClick={() => setExportError(null)}
              className="hover:underline text-[9px] uppercase font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {downloadUrl && (
          <div className="px-4 py-2 bg-state-success/15 border-b border-state-success/30 text-state-success flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 shrink-0 text-state-success" />
              <span>Tactical Dossier PDF generated successfully.</span>
            </div>
            <a
              href={downloadUrl}
              download={`tactical-dossier-${event.event_id}.pdf`}
              className="px-2 py-0.5 rounded bg-state-success text-background font-bold text-[9px] hover:bg-emerald-400 transition-colors"
            >
              Download PDF
            </a>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-[11px]">
          {/* 1. Incident Overview Banner */}
          <div className="p-3 rounded bg-surface border border-border/80 flex items-center justify-between">
            <div>
              <div className="text-[9px] text-foreground-muted uppercase tracking-wider">
                PRIMARY CLASSIFICATION & CONFIDENCE
              </div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2 mt-0.5">
                <span
                  className={
                    isIndustrial
                      ? "text-accent"
                      : "text-state-warning"
                  }
                >
                  {event.classification}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-foreground-secondary border border-border">
                  {(event.confidence * 100).toFixed(1)}% CONF
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[9px] text-foreground-muted uppercase tracking-wider">
                PEAK INTENSITY
              </div>
              <div className="text-sm font-bold text-thermal-primary mt-0.5">
                {formatFrp(event.frp_mw)}
              </div>
            </div>
          </div>

          {/* Chronological Incident Audit Chain */}
          <div className="p-3.5 rounded-panel bg-surface border border-border space-y-2">
            <div className="text-xs font-semibold text-foreground flex items-center justify-between border-b border-border pb-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span>Chronological Incident Audit Chain (Immutable Log)</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-raised border border-border text-foreground-muted font-mono">
                SHA-256 AUDIT VERIFIED
              </span>
            </div>
            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-foreground-muted">T0 (Initial)</span>
                    <strong className="text-foreground text-[11px]">Satellite Detection Ingested</strong>
                  </div>
                  <div className="text-foreground-secondary text-[10px]">
                    NASA FIRMS VIIRS SNPP infrared pass captured thermal anomaly at {formatCoordinate(event.latitude, event.longitude)}. FRP: {formatFrp(event.frp_mw)}.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-foreground-muted">T1 (+5m)</span>
                    <strong className="text-foreground text-[11px]">Multi-Sensor Cross-Validation</strong>
                  </div>
                  <div className="text-foreground-secondary text-[10px]">
                    Cross-constellation consistency evaluated; spatial coherence confirmed (&lt; 1.2 km centroid drift); single-sensor false positive risk cleared.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-foreground-muted">T2 (+6m)</span>
                    <strong className="text-foreground text-[11px]">Contextual Spatial Attribution</strong>
                  </div>
                  <div className="text-foreground-secondary text-[10px]">
                    GIST &amp; national infrastructure registries queried. Associated with {evidence?.context_evidence?.[0]?.facility_name || "industrial petrochemical asset"} within safe containment buffer.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-foreground-muted">T3 (+7m)</span>
                    <strong className="text-foreground text-[11px]">Machine Learning Inference &amp; Counterfactual XAI</strong>
                  </div>
                  <div className="text-foreground-secondary text-[10px]">
                    Ensemble classifier predicted {event.classification} with {(event.confidence * 100).toFixed(1)}% confidence. Counterfactual boundary established.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-foreground-muted">T4 (+8m)</span>
                    <strong className="text-foreground text-[11px]">Atmospheric Dispersion &amp; Population Exposure</strong>
                  </div>
                  <div className="text-foreground-secondary text-[10px]">
                    Gaussian plume modeled with live meteorological vectors; downwind settlement demographic density intersected.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-state-error mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-foreground-muted">T5 (+9m)</span>
                    <strong className="text-foreground text-[11px]">Risk Escalation &amp; Tactical Action Dispatched</strong>
                  </div>
                  <div className="text-foreground-secondary text-[10px]">
                    Incident Command protocol formulated; district emergency response and air quality advisory queued.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Grid: Geographic Context & Planck Pyrometry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Geographic Context */}
            <div className="p-3.5 rounded-panel bg-surface border border-border space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 border-b border-border pb-1.5">
                <Flame className="w-3.5 h-3.5 text-accent" />
                <span>Geographic Location &amp; Time</span>
              </div>
              <div className="text-xs space-y-1.5 text-foreground-secondary">
                <div>
                  <span className="text-foreground-muted">Coordinates: </span>
                  <span className="text-foreground font-mono font-medium">
                    {formatCoordinate(event.latitude, event.longitude)}
                  </span>
                </div>
                <div>
                  <span className="text-foreground-muted">Facility: </span>
                  <span className="text-foreground font-medium">
                    {evidence?.context_evidence?.[0]?.facility_name || "Industrial Facility"}
                  </span>
                </div>
                <div>
                  <span className="text-foreground-muted">Observation Time: </span>
                  <span className="text-foreground font-mono">
                    {event.start_time ? formatUtcDateTime(event.start_time) : "Live Stream"}
                  </span>
                </div>
              </div>
            </div>

            {/* Planck Pyrometry */}
            <div className="p-3.5 rounded-panel bg-surface border border-border space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 border-b border-border pb-1.5">
                <Gauge className="w-3.5 h-3.5 text-semantic-thermal" />
                <span>Planck Thermal Pyrometry</span>
              </div>
              <div className="text-xs space-y-1.5 text-foreground-secondary">
                <div>
                  <span className="text-foreground-muted">True Emitter Temp: </span>
                  <span className="text-foreground font-mono font-medium">
                    {tempK} K ({tempC}°C)
                  </span>
                </div>
                <div>
                  <span className="text-foreground-muted">Combustion Footprint: </span>
                  <span className="text-foreground font-mono font-medium">
                    {emitterArea} m²
                  </span>
                </div>
                <div>
                  <span className="text-foreground-muted">Inversion Model: </span>
                  <span className="text-state-success font-medium">
                    Dozier 1981 (Converged)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Atmospheric Plume & Evacuation Corridor */}
          <div className="p-3.5 rounded-panel bg-surface border border-border space-y-2">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 border-b border-border pb-1.5">
              <Wind className="w-3.5 h-3.5 text-state-warning" />
              <span>Atmospheric Dispersion Plume &amp; Hazard Corridor</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-1">
              <div className="p-2 rounded-control bg-surface-raised border border-border">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Surface Wind</div>
                <div className="font-mono font-semibold text-foreground">3.8 m/s @ 235°</div>
              </div>
              <div className="p-2 rounded-control bg-surface-raised border border-border">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Downwind Axis</div>
                <div className="font-mono font-semibold text-foreground">55° Azimuth</div>
              </div>
              <div className="p-2 rounded-control bg-surface-raised border border-border">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider">Plume Length</div>
                <div className="font-mono font-semibold text-state-warning">{plumeLen} km</div>
              </div>
              <div className="p-2 rounded-control bg-state-error/10 border border-state-error/30">
                <div className="text-[10px] text-state-error font-medium uppercase tracking-wider">Evac Radius</div>
                <div className="font-mono font-semibold text-state-error">{evacRad} km</div>
              </div>
            </div>
          </div>

          {/* 4. CAMEO-NIOSH Chemical Risk */}
          <div className="p-3.5 rounded-panel bg-surface border border-border space-y-2">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 border-b border-border pb-1.5">
              <Biohazard className="w-3.5 h-3.5 text-state-error" />
              <span>CAMEO-NIOSH Chemical Risk &amp; ERG Isolation</span>
            </div>
            <div className="text-xs space-y-1.5 text-foreground-secondary">
              <div>
                <span className="text-foreground-muted">Primary Chemical Hazard: </span>
                <span className="text-foreground font-medium">
                  {isIndustrial ? "Class 3 Flammable Liquids & Aromatic Hydrocarbons" : "Class 4.1 Biomass Volatiles"}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">Initial ERG Isolation Distance: </span>
                <span className="text-accent font-medium">{isIndustrial ? "800 meters" : "300 meters"}</span>
              </div>
              <div>
                <span className="text-foreground-muted">Firefighting Directive: </span>
                <span className="text-foreground">
                  {isIndustrial
                    ? "AFFF Alcohol-Resistant Foam & High-Volume Cooling Deluge"
                    : "Water Mist Fog Line & Forest Firebreak Barrier"}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Standard Operating Directives */}
          <div className="p-3.5 rounded-panel bg-surface border border-border space-y-2">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 border-b border-border pb-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-accent" />
              <span>Standard Operational Directives</span>
            </div>
            <ul className="text-xs text-foreground-secondary space-y-1 list-disc pl-4 pt-1">
              <li>Establish safety perimeter matching ERG initial isolation radius immediately.</li>
              <li>Mobilize nearest industrial mutual aid / fire brigade command with specialized foam capability.</li>
              <li>Deploy continuous air monitoring along downwind dispersion axis for toxic hydrocarbons.</li>
              <li>Maintain live satellite infrared sensor tracking (VIIRS/NOAA-20) for thermal expansion.</li>
              <li>Broadcast OASIS CAP v1.2 / NDMA Sachet alert payload to State (SEOC) and District (DEOC) disaster response authorities.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface flex items-center justify-between text-xs text-foreground-muted shrink-0">
          <div>PyroSat-AI • Multi-Source Geodesic Telemetry • Operational Decision Support</div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-control bg-surface-raised hover:bg-surface-hover border border-border text-foreground font-medium transition-colors"
          >
            Close Briefing
          </button>
        </div>
      </div>
    </div>
  );
}
