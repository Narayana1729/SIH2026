"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Radio,
  RotateCw,
  Search,
  Cpu,
  Clock,
  FilterX,
  Trees,
  Flame,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { EventCard } from "./EventCard";
import { ThermalEvent } from "@/types/event";
import { calculateOperationalRisk } from "@/lib/risk/scoring";
import { useEventContext } from "@/context/EventContext";
import { APP_CONFIG } from "@/config/ui";
import { cn } from "@/lib/utils";
import { GlobalForestMonitoringHub } from "./GlobalForestMonitoringHub";
import { ForestThreatDetailDrawer } from "./ForestThreatDetailDrawer";
import { useOverlayPosition } from "@/hooks/useOverlayPosition";
import { OverlayPositionControls } from "@/components/common/OverlayPositionControls";

export type EventSortOption = "newest" | "risk" | "frp" | "confidence" | "detections";

export interface EventIntelligenceFeedProps {
  events?: ThermalEvent[];
  selectedEvent?: ThermalEvent | null;
  onSelectEvent?: (event: ThermalEvent) => void;
  onClose?: () => void;
  className?: string;
}

export function EventIntelligenceFeed({
  events: propEvents,
  selectedEvent: propSelectedEvent,
  onSelectEvent,
  onClose,
  className,
}: EventIntelligenceFeedProps) {
  const {
    filteredEvents: contextEvents,
    selectedEvent: contextSelectedEvent,
    setSelectedEvent,
    setIsDetailOpen,
    selectedPriority,
    setSelectedPriority,
    stats,
    isLiveBackend,
    isLoading,
    isFetching,
    refetch,
    searchQuery,
    setSearchQuery,
    resetFilters,
  } = useEventContext();

  const events = propEvents || contextEvents;
  const selectedEvent = propSelectedEvent !== undefined ? propSelectedEvent : contextSelectedEvent;

  const [activeFeedTab, setActiveFeedTab] = useState<"THERMAL_EVENTS" | "FOREST_MONITORING">("THERMAL_EVENTS");
  const [inspectedForestId, setInspectedForestId] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<EventSortOption>("risk");
  const listContainerRef = useRef<HTMLDivElement>(null);

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
    id: "event-intelligence-feed",
    defaultMode: "docked-tr",
    allowedModes: ["docked-tr", "docked-tl", "docked-br", "docked-bl", "floating"],
    defaultCoordinates: () => ({
      x: typeof window !== "undefined" ? Math.max(16, window.innerWidth - 440) : 800,
      y: 72,
    }),
  });

  // Sort events based on selected sort option
  const sortedEvents = useMemo(() => {
    const list = [...events];
    switch (sortOption) {
      case "risk":
        return list.sort((a, b) => {
          const riskA = calculateOperationalRisk(a).score;
          const riskB = calculateOperationalRisk(b).score;
          return riskB - riskA;
        });
      case "frp":
        return list.sort((a, b) => b.frp_mw - a.frp_mw);
      case "confidence":
        return list.sort((a, b) => b.confidence - a.confidence);
      case "detections":
        return list.sort((a, b) => b.detection_count - a.detection_count);
      case "newest":
      default:
        return list.sort((a, b) => {
          const timeA = new Date(a.start_time).getTime() || 0;
          const timeB = new Date(b.start_time).getTime() || 0;
          return timeB - timeA;
        });
    }
  }, [events, sortOption]);

  // Handle event selection
  const handleSelect = (event: ThermalEvent) => {
    if (onSelectEvent) {
      onSelectEvent(event);
    } else {
      setSelectedEvent(event);
      setIsDetailOpen(true);
    }
  };

  return (
    <>
      <div
        ref={overlayCardRef}
        style={overlayStyle}
        className={cn(
          overlayContainerClassName,
          "w-[420px] max-w-[95vw] pointer-events-auto",
          isOverlayDragging && "shadow-2xl ring-1 ring-accent"
        )}
      >
        <Panel
          variant="glass"
          className={cn(
            "w-full max-h-[88vh] flex flex-col p-3 shadow-panel select-none font-mono",
            className
          )}
        >
        {/* Top Intelligence Tab Selector */}
        <div className="grid grid-cols-2 gap-1 mb-2.5 p-1 rounded-lg bg-surface border border-border">
          <button
            onClick={() => setActiveFeedTab("THERMAL_EVENTS")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all",
              activeFeedTab === "THERMAL_EVENTS"
                ? "bg-accent/20 text-accent border border-accent/40 shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            <Flame className="w-3.5 h-3.5 text-accent" />
            <span>THERMAL FIRES ({events.length})</span>
          </button>
          <button
            onClick={() => setActiveFeedTab("FOREST_MONITORING")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all",
              activeFeedTab === "FOREST_MONITORING"
                ? "bg-surface text-foreground border border-border shadow-sm font-medium"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            <Trees className="w-3.5 h-3.5 text-state-success" />
            <span>Forest Monitoring</span>
          </button>
        </div>

        {activeFeedTab === "FOREST_MONITORING" ? (
          <div className="flex-1 overflow-hidden">
            <GlobalForestMonitoringHub
              onSelectForest={(forestId) => {
                setInspectedForestId(forestId);
              }}
              onOpenForestDetail={(forestId) => {
                setInspectedForestId(forestId);
              }}
            />
          </div>
        ) : (
          <>
            {/* 1. Feed Header with Live Ingestion & Refresh Trigger */}
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-control bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-sans">
                    <span>Live Intelligence</span>
                    <Badge variant="thermal" size="sm" className="text-[10px] py-0 font-mono">
                      {events.length} Active
                    </Badge>
                  </div>
                  <div className="text-[11px] text-foreground-muted font-sans">
                    {isLiveBackend ? "FastAPI Ingestion Active" : "Multi-Source Telemetry"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <OverlayPositionControls
                  mode={overlayMode}
                  isDragging={isOverlayDragging}
                  onPointerDown={handleOverlayPointerDown}
                  onCycleMode={cycleOverlayMode}
                  onToggleFloating={toggleOverlayFloating}
                  onReset={resetOverlayPosition}
                />
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  title="Refresh event stream"
                  className="p-1.5 rounded-control bg-surface hover:bg-surface-raised border border-border text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RotateCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-accent")} />
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    title="Close Intelligence Feed"
                    className="p-1.5 rounded-control bg-surface hover:bg-surface-raised border border-border text-foreground-muted hover:text-foreground transition-colors text-xs font-medium px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>


      {/* 2. Operational Priority Quick Filter Buttons */}
      <div className="grid grid-cols-5 gap-1 mb-2.5 text-xs font-sans">
        <button
          onClick={() => setSelectedPriority("ALL")}
          className={cn(
            "p-1.5 rounded-control border text-center transition-all",
            selectedPriority === "ALL"
              ? "bg-surface-raised border-border-strong text-foreground font-semibold shadow-sm"
              : "bg-surface border-border text-foreground-muted hover:text-foreground hover:bg-surface-raised"
          )}
        >
          <div className="text-[9px] uppercase tracking-wider text-foreground-muted">All</div>
          <div className="font-mono font-medium">{stats.total}</div>
        </button>

        <button
          onClick={() => setSelectedPriority(selectedPriority === "CRITICAL" ? "ALL" : "CRITICAL")}
          className={cn(
            "p-1.5 rounded-control border text-center transition-all",
            selectedPriority === "CRITICAL"
              ? "bg-state-error/10 border-state-error/40 text-state-error font-semibold shadow-sm"
              : "bg-surface border-border text-state-error hover:bg-state-error/5"
          )}
        >
          <div className="text-[9px] uppercase tracking-wider">Crit</div>
          <div className="font-mono font-medium">{stats.critical}</div>
        </button>

        <button
          onClick={() => setSelectedPriority(selectedPriority === "HIGH" ? "ALL" : "HIGH")}
          className={cn(
            "p-1.5 rounded-control border text-center transition-all",
            selectedPriority === "HIGH"
              ? "bg-accent/10 border-accent/40 text-accent font-semibold shadow-sm"
              : "bg-surface border-border text-accent hover:bg-accent/5"
          )}
        >
          <div className="text-[9px] uppercase tracking-wider">High</div>
          <div className="font-mono font-medium">{stats.high}</div>
        </button>

        <button
          onClick={() => setSelectedPriority(selectedPriority === "MEDIUM" ? "ALL" : "MEDIUM")}
          className={cn(
            "p-1.5 rounded-control border text-center transition-all",
            selectedPriority === "MEDIUM"
              ? "bg-state-warning/10 border-state-warning/40 text-state-warning font-semibold shadow-sm"
              : "bg-surface border-border text-state-warning hover:bg-state-warning/5"
          )}
        >
          <div className="text-[9px] uppercase tracking-wider">Med</div>
          <div className="font-mono font-medium">{stats.medium}</div>
        </button>

        <button
          onClick={() => setSelectedPriority(selectedPriority === "REVIEW_REQUIRED" ? "ALL" : "REVIEW_REQUIRED")}
          className={cn(
            "p-1.5 rounded-control border text-center transition-all",
            selectedPriority === "REVIEW_REQUIRED"
              ? "bg-semantic-info/10 border-semantic-info/40 text-semantic-info font-semibold shadow-sm"
              : "bg-surface border-border text-foreground-muted hover:bg-surface-raised"
          )}
        >
          <div className="text-[9px] uppercase tracking-wider">Rev</div>
          <div className="font-mono font-medium">{stats.reviewRequired}</div>
        </button>
      </div>

      {/* 3. Search & Sort Controls Strip */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="relative flex-1">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed / location..."
            className="w-full h-7 pl-6 pr-2 bg-background/70 border border-border rounded-control text-[11px] text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as EventSortOption)}
            className="h-7 px-2 bg-surface border border-border rounded-control text-[10px] text-foreground-secondary hover:text-foreground focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="risk">Max Risk</option>
            <option value="frp">Max FRP</option>
            <option value="confidence">Confidence</option>
            <option value="detections">Detections</option>
          </select>
        </div>
      </div>

      {/* 4. Scrollable Event Card Stream */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[52vh] scrollbar-thin"
      >
        {isLoading && events.length === 0 ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-control bg-surface/50 border border-border/40 animate-pulse"
              />
            ))}
          </div>
        ) : sortedEvents.length > 0 ? (
          sortedEvents.map((evt) => (
            <EventCard
              key={evt.event_id}
              event={evt}
              isSelected={selectedEvent?.event_id === evt.event_id}
              onSelect={handleSelect}
            />
          ))
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/80 rounded-control bg-surface/30">
            <FilterX className="w-6 h-6 text-foreground-muted mb-2" />
            <div className="text-xs text-foreground font-semibold">No Matching Anomalies</div>
            <div className="text-[10px] text-foreground-muted mt-1 max-w-[200px]">
              No thermal events match active search or time-window criteria.
            </div>
            <button
              onClick={resetFilters}
              className="mt-3 px-2.5 py-1 text-[10px] rounded-control bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* 5. Provenance & Calibration Footer */}
      <div className="mt-2.5 pt-2 border-t border-border/60 text-[9px] text-foreground-muted flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Cpu className="w-2.5 h-2.5 text-accent-cyan" /> {APP_CONFIG.modelName}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 text-foreground-muted" /> {APP_CONFIG.featureSchema}
        </span>
      </div>
          </>
        )}
      </Panel>
    </div>

      {/* Forest Threat Detail Drawer */}
      {inspectedForestId && (
        <ForestThreatDetailDrawer
          forestId={inspectedForestId}
          onClose={() => setInspectedForestId(null)}
          onNavigateToEvent={(eventId) => {
            const targetEvt = events.find((e) => e.event_id === eventId);
            if (targetEvt) {
              handleSelect(targetEvt);
              setActiveFeedTab("THERMAL_EVENTS");
            }
          }}
        />
      )}
    </>
  );
}

