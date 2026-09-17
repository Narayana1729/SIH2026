"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ThermalEvent } from "@/types/event";
import { useEventDetail } from "@/hooks/useEventDetail";
import { useEventDispersion } from "@/hooks/useEventDispersion";
import { EventClassificationHeader } from "./EventClassificationHeader";
import { ClassProbabilityBreakdown } from "./ClassProbabilityBreakdown";
import { EventOverviewGrid } from "./EventOverviewGrid";
import { WindVectorCard } from "./WindVectorCard";
import { HazardDispersionCard } from "./HazardDispersionCard";
import { IndustrialAssetSection } from "./IndustrialAssetSection";
import { ForestProximityCard } from "./ForestProximityCard";
import { ExplainableAiSection } from "./ExplainableAiSection";
import { PlanckPyrometrySection } from "./PlanckPyrometrySection";
import { HistoricalCurveSection } from "./HistoricalCurveSection";
import { HazmatRiskCard } from "./HazmatRiskCard";
import { ModelProvenanceCollapsible } from "./ModelProvenanceCollapsible";
import { EventDetailSkeleton } from "./EventDetailSkeleton";
import { EventDetailError } from "./EventDetailError";
import { generateXaiExplanation } from "@/lib/xai/explainer";
import { calculateOperationalRisk, getRiskLevelStyles } from "@/lib/risk/scoring";
import { formatHumanReadableLocation } from "@/lib/location/locationFilter";
import { Badge } from "@/components/ui/Badge";
import { EmergencyResponseSection } from "./EmergencyResponse/EmergencyResponseSection";
import { EmergencyResponseModal } from "./EmergencyResponse/EmergencyResponseModal";
import { TacticalDossierModal } from "@/components/dossier/TacticalDossierModal";
import { ContextualMediaSection } from "./ContextualMediaSection";
import { computeIncidentEvolution } from "@/lib/evolution/evolution";
import { calculatePopulationExposure } from "@/lib/exposure/exposure";
import { validateSatelliteObservations } from "@/lib/validation/cross-sensor";
import { computeThermalAnomalyProfile } from "@/lib/anomaly/anomaly";
import { computeSatelliteRevisitForecast } from "@/lib/satellite/revisitPredictor";
import { IncidentEvolutionCard } from "./IncidentEvolutionCard";
import { PopulationExposureCard } from "./PopulationExposureCard";
import { SatelliteCrossValidationCard } from "./SatelliteCrossValidationCard";
import { SatelliteRevisitCard } from "./SatelliteRevisitCard";
import { ThermalAnomalyEarlyWarningCard } from "./ThermalAnomalyEarlyWarningCard";
import { OperatorFeedbackWidget } from "./OperatorFeedbackWidget";
import { MissionControlWorkflow } from "./MissionControlWorkflow";
import { ExplainIncidentModal } from "./ExplainIncidentModal";
import { PacConsistencyCard } from "./PacConsistencyCard";
import { APP_CONFIG } from "@/config/ui";
import {
  Flame,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Crosshair,
  ShieldAlert,
  Info,
  CheckCircle2,
  Cpu,
  FileText,
  Siren,
  Wind,
  Compass,
  ArrowUpRight,
  Radio,
  Layers,
  Sparkles,
} from "lucide-react";
import { useEventContext } from "@/context/EventContext";
import { useOverlayPosition } from "@/hooks/useOverlayPosition";
import { OverlayPositionControls } from "@/components/common/OverlayPositionControls";

export type IntelligencePanelTab = "OVERVIEW" | "EVIDENCE" | "MEDIA";

export interface EventIntelligencePanelProps {
  event: ThermalEvent | null;
  currentIndex?: number;
  totalEvents?: number;
  onPrevEvent?: () => void;
  onNextEvent?: () => void;
  onCenterMap?: () => void;
  onClose: () => void;
  className?: string;
}

export function EventIntelligencePanel({
  event,
  currentIndex = 0,
  totalEvents = 0,
  onPrevEvent,
  onNextEvent,
  onCenterMap,
  onClose,
  className,
}: EventIntelligencePanelProps) {
  const eventContext = useEventContext();
  const [localDossierOpen, setLocalDossierOpen] = useState(false);
  const [localResponseCenterOpen, setLocalResponseCenterOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<IntelligencePanelTab>("OVERVIEW");
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);

  // Universal Overlay Positioning System
  const {
    mode: overlayMode,
    isDragging: isOverlayDragging,
    cardRef: overlayCardRef,
    handlePointerDown: handleOverlayPointerDown,
    cycleMode: cycleOverlayMode,
    toggleFloating: toggleOverlayFloating,
    resetPosition: resetOverlayPosition,
    containerStyle: overlayStyle,
    containerClassName: overlayContainerClassName,
  } = useOverlayPosition({
    id: "event-intelligence-panel",
    defaultMode: "docked-bl",
    allowedModes: ["docked-bl", "docked-br", "docked-tl", "docked-tr", "floating"],
    defaultCoordinates: () => ({
      x: 16,
      y: typeof window !== "undefined" ? Math.max(80, window.innerHeight - 560) : 320,
    }),
  });

  const isDossierModalOpen = eventContext?.isDossierOpen || localDossierOpen;
  const setIsDossierModalOpen = (open: boolean) => {
    setLocalDossierOpen(open);
    eventContext?.setIsDossierOpen(open);
  };

  const isResponseCenterOpen = eventContext?.isResponseCenterOpen || localResponseCenterOpen;
  const setIsResponseCenterOpen = (open: boolean) => {
    setLocalResponseCenterOpen(open);
    eventContext?.setIsResponseCenterOpen(open);
  };

  const {
    evidence,
    intelligence,
    timeline,
    isLoading,
    isError,
    error,
    refetch,
  } = useEventDetail(event?.event_id, event);

  const {
    dispersion,
    isLoading: isDispersionLoading,
  } = useEventDispersion(event);

  // Compute Incident Evolution dynamics across overpasses
  const evolution = useMemo(() => {
    if (!event) return null;
    return computeIncidentEvolution(event, timeline?.timeline);
  }, [event, timeline]);

  // Compute Downwind Population and Critical Infrastructure Exposure
  const exposure = useMemo(() => {
    if (!event) return null;
    return calculatePopulationExposure(event, dispersion);
  }, [event, dispersion]);

  // Compute Multi-Satellite Cross-Validation Agreement
  const crossValidation = useMemo(() => {
    if (!event) return null;
    return validateSatelliteObservations(event, timeline?.timeline);
  }, [event, timeline]);

  // Compute Early-Warning Baseline Anomaly Profile
  const anomaly = useMemo(() => {
    if (!event) return null;
    return computeThermalAnomalyProfile(event);
  }, [event]);

  // Compute Satellite Revisit Schedule and Scan Footprint Geometry
  const revisitForecast = useMemo(() => {
    if (!event) return null;
    return computeSatelliteRevisitForecast(event);
  }, [event]);

  // Compute operational risk assessment using 6-factor formulation
  const risk = useMemo(() => {
    if (!event) return null;
    return calculateOperationalRisk(event, evolution, exposure);
  }, [event, evolution, exposure]);

  const riskStyles = useMemo(() => {
    if (!risk) return null;
    return getRiskLevelStyles(risk.level);
  }, [risk]);

  // Compute grounded XAI explanation
  const xai = useMemo(() => {
    if (!event) return null;
    return generateXaiExplanation(event, evidence, intelligence);
  }, [event, evidence, intelligence]);

  // Nearest contextual asset for PAC consistency analysis
  const nearestAsset = useMemo(() => {
    if (!evidence?.context_evidence?.length) return null;
    const valid = evidence.context_evidence.filter((c) => typeof c.distance_meters === "number");
    if (!valid.length) return null;
    return [...valid].sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0))[0];
  }, [evidence]);

  if (!event || !risk || !riskStyles || !xai) {
    return (
      <div
        className={cn(
          "w-full sm:w-88 bg-surface-raised/95 backdrop-blur-md border border-border rounded-panel p-4 shadow-panel pointer-events-auto text-foreground-muted font-mono text-xs text-center",
          className
        )}
      >
        <div className="w-8 h-8 rounded-full bg-surface-hover mx-auto flex items-center justify-center mb-2">
          <Flame className="w-4 h-4 text-foreground-muted" />
        </div>
        <div className="font-semibold text-foreground">NO EVENT SELECTED</div>
        <p className="text-[11px] text-foreground-muted mt-1">
          Select a thermal anomaly on the map to inspect its real-time intelligence.
        </p>
      </div>
    );
  }

  if (isError && !evidence) {
    return (
      <EventDetailError
        message={error?.message || "Failed to load event intelligence"}
        onRetry={refetch}
        onClose={onClose}
        className={className}
      />
    );
  }

  const isIndustrial = event.classification === "INDUSTRIAL";
  const isUnknown = event.classification === "UNKNOWN";

  return (
    <>
      <div
        ref={overlayCardRef}
        style={overlayStyle}
        className={cn(
          overlayContainerClassName,
          "w-full sm:w-96 bg-surface-raised/95 backdrop-blur-md border border-border rounded-t-panel sm:rounded-panel shadow-panel pointer-events-auto flex flex-col select-none transition-shadow duration-150",
          isOverlayDragging && "shadow-2xl ring-1 ring-accent",
          isCollapsed
            ? "p-3 sm:p-3.5"
            : "max-h-[60vh] sm:max-h-[86vh] overflow-y-auto p-3.5 sm:p-4 gap-3 animate-in fade-in slide-in-from-bottom-3 scrollbar-thin",
          className
        )}
      >
        {/* 1. Header with Event ID, Pagination Navigation & Controls */}
        <div
          className={cn(
            "flex items-start justify-between gap-2",
            isCollapsed ? "border-b-0 pb-0" : "border-b border-border pb-2.5"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "w-7 h-7 sm:w-8 sm:h-8 rounded-control flex items-center justify-center shrink-0 border",
                isIndustrial
                  ? "bg-accent/15 border-accent/30 text-accent"
                  : isUnknown
                  ? "bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan"
                  : "bg-state-warning/15 border-state-warning/30 text-state-warning"
              )}
            >
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-flame" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-xs font-bold text-foreground tracking-wider truncate">
                  {event.event_id}
                </span>
                {totalEvents > 1 && (
                  <span className="text-[10px] text-foreground-muted px-1.5 py-0.5 rounded bg-surface border border-border/60 shrink-0">
                    {String(currentIndex + 1).padStart(2, "0")}/{String(totalEvents).padStart(2, "0")}
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-foreground-muted truncate max-w-[170px]">
                {formatHumanReadableLocation(event)}
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Universal Overlay Position Controls */}
            <OverlayPositionControls
              mode={overlayMode}
              isDragging={isOverlayDragging}
              onPointerDown={handleOverlayPointerDown}
              onCycleMode={cycleOverlayMode}
              onToggleFloating={toggleOverlayFloating}
              onReset={resetOverlayPosition}
            />

            {onPrevEvent && (
              <button
                onClick={onPrevEvent}
                title="Previous Event (←)"
                aria-label="Previous Event"
                className="p-1 text-foreground-muted hover:text-foreground rounded-control hover:bg-surface-hover active:scale-95 transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {onNextEvent && (
              <button
                onClick={onNextEvent}
                title="Next Event (→)"
                aria-label="Next Event"
                className="p-1 text-foreground-muted hover:text-foreground rounded-control hover:bg-surface-hover active:scale-95 transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onCenterMap && (
              <button
                onClick={onCenterMap}
                title="Center Map on Target"
                aria-label="Center Map"
                className="p-1 text-foreground-muted hover:text-accent rounded-control hover:bg-surface-hover active:scale-95 transition-all"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Expand incident details" : "Collapse incident details"}
              aria-label={isCollapsed ? "Expand incident details" : "Collapse incident details"}
              className="p-1 text-foreground-muted hover:text-foreground rounded-control hover:bg-surface-hover active:scale-95 transition-all"
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Minimize / Close Panel (Esc)"
              aria-label="Close event intelligence panel"
              className="p-1 text-foreground-muted hover:text-state-error rounded-control hover:bg-surface-hover active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* 7-Step Operational Mission Control Pipeline */}
            <MissionControlWorkflow currentStep={6} />

            {/* Tactical Intelligence Tab Switcher */}
            <div className="flex items-center gap-1 bg-surface-raised p-0.5 rounded-control border border-border">
              <button
                type="button"
                onClick={() => setActiveTab("OVERVIEW")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-xs font-sans font-medium rounded-[5px] transition-all",
                  activeTab === "OVERVIEW"
                    ? "bg-surface text-foreground shadow-sm border border-border"
                    : "text-foreground-secondary hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("EVIDENCE")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-xs font-sans font-medium rounded-[5px] transition-all",
                  activeTab === "EVIDENCE"
                    ? "bg-surface text-foreground shadow-sm border border-border"
                    : "text-foreground-secondary hover:text-foreground"
                )}
              >
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Evidence &amp; XAI</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("MEDIA")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-xs font-sans font-medium rounded-[5px] transition-all",
                  activeTab === "MEDIA"
                    ? "bg-surface text-foreground shadow-sm border border-border"
                    : "text-foreground-secondary hover:text-foreground"
                )}
              >
                <Radio className="w-3.5 h-3.5 text-semantic-warning" />
                <span>News &amp; Media</span>
              </button>
            </div>

            {/* Tactical Action Triggers: Dossier & Explain Incident */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsDossierModalOpen(true)}
                className="py-1.5 px-2.5 rounded-control bg-surface-raised hover:bg-surface-hover border border-border text-foreground-secondary hover:text-foreground text-xs font-sans font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span className="truncate">Tactical Dossier</span>
              </button>

              <button
                onClick={() => setIsExplainModalOpen(true)}
                className="py-1.5 px-2.5 rounded-control bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="truncate">Explain Incident</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "OVERVIEW" && (
              <>
                {/* 1. Operational Action Protocol Recommendation */}
                {risk?.actionRecommendation && (
                  <div className="p-3 rounded-panel bg-surface border border-state-error/30 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ShieldAlert className="w-4 h-4 text-state-error shrink-0" />
                        <span className="text-xs font-bold text-foreground truncate">
                          Action: {risk.actionRecommendation.headline}
                        </span>
                      </div>
                      <Badge variant="error" size="sm" className="font-mono text-[10px] shrink-0">
                        {risk.actionRecommendation.responseWindowMinutes} MIN
                      </Badge>
                    </div>
                    <p className="text-[11px] text-foreground-secondary leading-relaxed bg-surface-raised p-2 rounded-control border border-border">
                      {risk.actionRecommendation.primaryAction}
                    </p>
                  </div>
                )}

                {/* 1b. Tri-Focal Physics-AI-Context (PAC) Consistency Verification */}
                <PacConsistencyCard
                  event={event}
                  pyrometry={intelligence?.pyrometry ?? null}
                  nearestAssetDistanceMeters={nearestAsset?.distance_meters ?? null}
                  assetName={nearestAsset?.facility_name ?? null}
                />

                {/* 2. Incident Evolution Dynamics */}
                {evolution && <IncidentEvolutionCard evolution={evolution} />}

                {/* 3. Downwind Population & Infrastructure Exposure */}
                {exposure && <PopulationExposureCard exposure={exposure} />}

                {/* 4. Satellite Cross-Validation Agreement */}
                {crossValidation && <SatelliteCrossValidationCard validation={crossValidation} />}

                {/* 4b. Satellite Orbital Revisit & Scan Geometry */}
                {revisitForecast && <SatelliteRevisitCard revisit={revisitForecast} />}

                {/* 5. Early-Warning Thermal Anomaly Detection */}
                {anomaly && <ThermalAnomalyEarlyWarningCard anomaly={anomaly} />}

                {/* 6. Wind Intelligence & Downwind Plume */}
                <div
                  data-testid="top-wind-intelligence-card"
                  className="p-3 rounded-panel font-sans space-y-2.5 shadow-sm border bg-surface border-border transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Wind className="w-4 h-4 shrink-0 text-accent" />
                      <span className="text-xs font-semibold text-foreground truncate">
                        Wind Intelligence &amp; Plume
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border font-medium shrink-0",
                        dispersion?.data_quality === "LIVE"
                          ? "bg-state-success/10 text-state-success border-state-success/30"
                          : dispersion?.data_quality === "FALLBACK" || dispersion?.data_quality === "CACHED"
                          ? "bg-state-warning/10 text-state-warning border-state-warning/30"
                          : "bg-surface-raised text-foreground-muted border-border"
                      )}
                    >
                      {dispersion?.data_quality === "LIVE"
                        ? "Live Meteorology"
                        : dispersion?.data_quality === "FALLBACK"
                        ? "Fallback Simulation"
                        : dispersion?.data_quality === "CACHED"
                        ? "Cached Meteorology"
                        : isDispersionLoading
                        ? "Calculating..."
                        : "Ready"}
                    </span>
                  </div>

                  {dispersion?.wind ? (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-surface-raised p-2.5 rounded-control border border-border">
                      <div>
                        <span className="text-foreground-muted block text-[10px]">
                          Wind Velocity
                        </span>
                        <span className="font-mono font-semibold text-foreground text-xs">
                          {dispersion.wind.speed_ms.toFixed(1)} m/s{" "}
                          <span className="text-foreground-muted font-normal text-[10px]">
                            ({(dispersion.wind.speed_ms * 3.6).toFixed(1)} km/h)
                          </span>
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground-muted block text-[10px]">
                          Hazard Bearing
                        </span>
                        <span className="font-mono font-semibold text-state-error text-xs flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          {dispersion.wind.direction_from_label} → {dispersion.wind.downwind_direction_label}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1.5 border-t border-border flex items-center justify-between">
                        <span className="text-foreground-muted text-[10px]">
                          Downwind Reach / Corridor
                        </span>
                        <span className="font-mono font-medium text-xs text-accent">
                          {dispersion.dispersion.max_hazard_distance_km.toFixed(1)} km (Stability {dispersion.dispersion.stability_class})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-foreground-muted bg-surface-raised p-2 rounded-control border border-border">
                      {isDispersionLoading ? "Calculating Gaussian plume atmospheric dispersion..." : "Atmospheric wind vectors & plume ready."}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onCenterMap?.();
                      setActiveTab("EVIDENCE");
                    }}
                    className="w-full py-1.5 px-3 rounded-control font-medium text-xs bg-surface-raised hover:bg-surface-hover border border-border text-foreground flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Compass className="w-3.5 h-3.5 text-accent" />
                    <span>Focus Wind &amp; Plume Dispersion</span>
                  </button>
                </div>

                {/* Emergency Response & Regulation */}
                <div
                  data-testid="top-emergency-response-card"
                  className={cn(
                    "p-3 rounded-panel font-sans space-y-2.5 shadow-sm border transition-all duration-200",
                    risk.level === "CRITICAL"
                      ? "bg-state-error/5 border-state-error/30"
                      : "bg-surface border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Siren
                        className={cn(
                          "w-4 h-4 shrink-0",
                          risk.level === "CRITICAL"
                            ? "text-state-error"
                            : "text-accent"
                        )}
                      />
                      <span className="text-xs font-semibold text-foreground truncate">
                        Emergency Response &amp; Regulation
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border font-medium shrink-0",
                        risk.level === "CRITICAL"
                          ? "bg-state-error/10 text-state-error border-state-error/30"
                          : risk.level === "HIGH"
                          ? "bg-accent/10 text-accent border-accent/30"
                          : "bg-surface-raised text-foreground-muted border-border"
                      )}
                    >
                      {risk.level === "CRITICAL"
                        ? "Critical Escalation"
                        : risk.level === "HIGH"
                        ? "Response Available"
                        : "Standby"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-surface-raised p-2.5 rounded-control border border-border">
                    <div>
                      <span className="text-foreground-muted block text-[10px]">
                        Decision Confidence
                      </span>
                      <span className="font-mono font-semibold text-foreground text-xs">
                        {(event.confidence * (event.confidence <= 1 ? 100 : 1)).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-foreground-muted block text-[10px]">
                        Operational Attention
                      </span>
                      <span
                        className={cn(
                          "font-mono font-semibold text-xs",
                          risk.level === "CRITICAL"
                            ? "text-state-error"
                            : risk.level === "HIGH"
                            ? "text-accent"
                            : "text-foreground"
                        )}
                      >
                        {risk.level} {risk.isIndeterminate ? "" : `(${risk.score}/100)`}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1.5 border-t border-border flex items-center justify-between">
                      <span className="text-foreground-muted text-[10px]">
                        Medical Escalation
                      </span>
                      <span
                        className={cn(
                          "font-mono font-medium text-[11px]",
                          risk.level === "CRITICAL" || event.frp_mw > 50
                            ? "text-state-error"
                            : "text-foreground-muted"
                        )}
                      >
                        {risk.level === "CRITICAL" || event.frp_mw > 50
                          ? "Required (Burn ICU)"
                          : "Standby"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsResponseCenterOpen(true)}
                    className={cn(
                      "w-full py-1.5 px-3 rounded-control font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm",
                      risk.level === "CRITICAL"
                        ? "bg-state-error hover:bg-state-error/90 text-white"
                        : "bg-accent hover:bg-accent/90 text-white"
                    )}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Open Response Center</span>
                  </button>
                </div>

                {/* Level 1 & 2: Classification, Confidence & Operating Policy */}
                <EventClassificationHeader
                  event={event}
                  operatingMode={xai.provenance.operatingMode}
                />

                {/* Level 2: Calibrated Class Probabilities */}
                <ClassProbabilityBreakdown probabilities={xai.probabilities} />

                {/* Level 3: Geographic Centroid, FRP, Detections, Satellite */}
                <EventOverviewGrid event={event} />

                {/* Level 4: Operational Risk & Hazard Evaluation */}
                <div className="p-2.5 rounded-control bg-surface/90 border border-border/80 font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-foreground-muted uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-accent" />
                      Operational Attention Level
                    </span>
                    <span
                      className={cn(
                        "font-bold text-[10.5px] px-1.5 py-0.2 rounded border uppercase",
                        riskStyles.bg,
                        riskStyles.text,
                        riskStyles.border
                      )}
                    >
                      {risk.level}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground-secondary leading-relaxed">
                    {risk.summary}
                  </p>
                </div>

                {/* Level 5: Human-in-the-Loop Operator Verification */}
                <OperatorFeedbackWidget eventId={event.event_id} />
              </>
            )}

            {/* TAB 2: EVIDENCE & XAI */}
            {activeTab === "EVIDENCE" && (
              <>
                {isLoading && !evidence ? (
                  <EventDetailSkeleton />
                ) : (
                  <>
                    {/* Level 2.5: Full Detailed Emergency Response Workspace */}
                    <EmergencyResponseSection event={event} evidence={evidence} />

                    {/* Level 3.5: Atmospheric Conditions, Live Wind Vector & Gaussian Dispersion */}
                    <div id="wind-intelligence-detail" className="space-y-3 scroll-mt-2">
                      <WindVectorCard
                        wind={dispersion?.wind}
                        dataQuality={dispersion?.data_quality}
                        isLoading={isDispersionLoading}
                      />

                      <HazardDispersionCard
                        dispersion={dispersion}
                        isLoading={isDispersionLoading}
                      />
                    </div>

                    {/* Level 4: Nearby Critical Infrastructure & Land Cover Exposure */}
                    <IndustrialAssetSection
                      event={event}
                      evidence={evidence}
                    />

                    {/* Level 4.5: Forest Proximity Detection & Threat Warnings */}
                    <ForestProximityCard event={event} />

                    {/* Level 4: Sub-Pixel Pyrometry (Planck Curve & Flare Radiance) */}
                    <PlanckPyrometrySection
                      event={event}
                      pyrometry={intelligence?.pyrometry}
                    />

                    {/* Level 4: 90-Day Historical Longitudinal Curve & Recurrence */}
                    <HistoricalCurveSection
                      event={event}
                      baseline={intelligence?.temporal_baseline}
                    />

                    {/* Level 4: CAMEO-NIOSH Chemical Hazards */}
                    <HazmatRiskCard event={event} evidence={evidence} />

                    {/* Level 4: Grounded Explainable AI Evidence Signals */}
                    <ExplainableAiSection
                      event={event}
                      evidence={evidence}
                      intelligence={intelligence}
                    />

                    {/* Level 6: Model Provenance & Verification Lineage */}
                    <ModelProvenanceCollapsible provenance={xai.provenance} />
                  </>
                )}
              </>
            )}

            {/* TAB 3: CONTEXTUAL NEWS & MEDIA */}
            {activeTab === "MEDIA" && (
              <ContextualMediaSection event={event} />
            )}

            {/* Footer Provenance Stamp */}
            <div className="mt-auto pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-foreground-muted">
              <div className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-accent" />
                <span>Lineage: {APP_CONFIG.featureSchema}</span>
              </div>
              <div className="flex items-center gap-1 text-accent">
                <CheckCircle2 className="w-3 h-3" />
                <span>NASA FIRMS Calibrated</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dedicated Emergency Response Center Modal */}
      <EmergencyResponseModal
        isOpen={isResponseCenterOpen}
        event={event}
        evidence={evidence}
        onClose={() => setIsResponseCenterOpen(false)}
      />

      {/* Tactical Incident Dossier Modal */}
      <TacticalDossierModal
        event={event}
        evidence={evidence}
        isOpen={isDossierModalOpen}
        onClose={() => setIsDossierModalOpen(false)}
      />

      {/* 360-Degree Operational Explain Incident Modal */}
      <ExplainIncidentModal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        event={event}
        evolution={evolution}
        exposure={exposure}
        risk={risk}
        evidence={evidence}
      />
    </>
  );
}
