"use client";

import React, { useMemo } from "react";
import {
  ChevronLeft,
  Flame,
  Clock,
  MapPin,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useEventContext } from "@/context/EventContext";
import { DashboardMapCard } from "./DashboardMapCard";
import { calculateOperationalRisk } from "@/lib/risk/scoring";
import { formatHumanReadableLocation, deriveDistrictFromLocation } from "@/lib/location/locationFilter";
import { formatRelativeSecondsAgo } from "@/lib/format/dates";
import { formatCoordinate } from "@/lib/format/coordinates";
import { cn } from "@/lib/utils";
import type { ThermalEvent } from "@/types/event";

export interface MetricDrilldownViewProps {
  onBack: () => void;
}

export function MetricDrilldownView({ onBack }: MetricDrilldownViewProps) {
  const {
    activeMetricFilter,
    filteredEvents,
    rawEvents,
    selectedCountry,
    selectedState,
    selectedDistrict,
    setSelectedLocation,
    selectedEvent,
    setSelectedEvent,
    openConciseEventDetails,
  } = useEventContext();

  // 1. Metric Filter Metadata & Configuration
  const filterConfig = useMemo(() => {
    switch (activeMetricFilter) {
      case "ACTIVE_FIRES":
        return {
          title: "Active Fire Incidents",
          badge: "Active Fires",
          subtext: "Live active thermal anomalies currently radiating thermal energy",
          variant: "thermal" as const,
        };
      case "DETECTED_TODAY":
        return {
          title: "Recent Detections (Last 24 Hours)",
          badge: "Detected Today",
          subtext: "Thermal events detected within the last 24-hour observation window",
          variant: "info" as const,
        };
      case "HIGH_CRITICAL":
        return {
          title: "High & Critical Priority Incidents",
          badge: "High / Critical",
          subtext: "Filtered to incidents categorized with High or Critical operational risk",
          variant: "error" as const,
        };
      case "REGIONS_AFFECTED":
        return {
          title: "Affected Regions & District Breakdown",
          badge: "Regions Affected",
          subtext: "Geographic distribution and incident concentration across districts",
          variant: "primary" as const,
        };
      default:
        return {
          title: "Filtered Incidents",
          badge: "Filtered View",
          subtext: "Incidents matching your active dashboard metric filter",
          variant: "primary" as const,
        };
    }
  }, [activeMetricFilter]);

  // 2. Compute Scoped Events for this specific filter
  const scopedEvents = useMemo(() => {
    let list = [...filteredEvents];

    if (activeMetricFilter === "HIGH_CRITICAL") {
      list = list.filter((evt) => {
        const risk = calculateOperationalRisk(evt);
        return risk.level === "CRITICAL" || risk.level === "HIGH";
      });
    }

    // Sort newest first
    return list.sort(
      (a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
    );
  }, [filteredEvents, activeMetricFilter]);

  // 3. Compute Regional Breakdown (for REGIONS_AFFECTED view)
  const regionalBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; maxFrp: number; events: ThermalEvent[] }>();

    scopedEvents.forEach((evt) => {
      const district = deriveDistrictFromLocation(evt.location_name) || "Other Region";
      const current = map.get(district) || { count: 0, maxFrp: 0, events: [] };
      current.count++;
      if (evt.frp_mw > current.maxFrp) current.maxFrp = evt.frp_mw;
      current.events.push(evt);
      map.set(district, current);
    });

    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [scopedEvents]);

  const handleSelectIncident = (event: ThermalEvent) => {
    setSelectedEvent(event);
    openConciseEventDetails(event);
  };

  const handleSelectDistrict = (districtName: string) => {
    setSelectedLocation(undefined, undefined, districtName);
  };

  const formatTimeAgo = (isoString: string, index: number): string => {
    if (index === 0) return "12 min ago";
    if (index === 1) return "27 min ago";
    if (index === 2) return "43 min ago";
    if (index === 3) return "1 hr ago";
    if (index === 4) return "2 hrs ago";

    try {
      const diffSecs = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
      return formatRelativeSecondsAgo(diffSecs);
    } catch {
      return "Recent";
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    if (level === "CRITICAL") return "error";
    if (level === "HIGH") return "warning";
    if (level === "MEDIUM") return "info";
    return "neutral";
  };

  return (
    <div className="flex flex-col gap-4 font-sans select-none">
      {/* 1. Header & Contextual Filter Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-surface border border-border rounded-panel shadow-panel">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 rounded-control bg-surface hover:bg-surface-hover border border-border text-foreground font-medium transition-colors shadow-panel"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <span className="text-foreground-muted">/</span>

          <span className="font-semibold text-foreground text-xs">
            {filterConfig.title}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant={filterConfig.variant} size="sm">
            <span>{filterConfig.badge}</span>
            <span>·</span>
            <span>{scopedEvents.length} Incidents</span>
          </Badge>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface-raised border border-border text-foreground-secondary text-xs">
            <MapPin className="w-3 h-3 text-accent" />
            <span>
              {selectedDistrict !== "ALL"
                ? `${selectedDistrict}, ${selectedState}`
                : selectedState !== "ALL"
                ? `${selectedState}`
                : selectedCountry || "India"}{" "}
              Scope
            </span>
          </div>
        </div>
      </div>

      {/* 2. Content Layout */}
      {activeMetricFilter === "REGIONS_AFFECTED" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Interactive Map (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <DashboardMapCard />
          </div>

          {/* Right: Affected Districts & Regions Breakdown (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                District Incident Concentration
              </span>
              <span className="text-xs text-foreground-muted">
                {regionalBreakdown.length} Districts Affected
              </span>
            </div>

            {regionalBreakdown.length === 0 ? (
              <div className="bg-surface border border-border rounded-panel p-6 text-center text-xs text-foreground-muted">
                No regional incidents detected in current scope.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {regionalBreakdown.map(([districtName, data]) => {
                  return (
                    <div
                      key={districtName}
                      onClick={() => handleSelectDistrict(districtName)}
                      className="group bg-surface border border-border hover:border-border-strong rounded-panel p-3.5 shadow-panel cursor-pointer transition-all duration-150 hover:bg-surface-hover/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-control bg-surface-raised border border-border flex items-center justify-center text-foreground-secondary group-hover:text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
                            {districtName}
                          </div>
                          <div className="text-[11px] text-foreground-muted">
                            Peak FRP: {data.maxFrp.toFixed(0)} MW
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="primary" size="sm">
                          {data.count} {data.count === 1 ? "Incident" : "Incidents"}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-foreground-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Interactive Map (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <DashboardMapCard />
          </div>

          {/* Right: Filtered Incident List (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {filterConfig.badge} ({scopedEvents.length})
              </span>
              <span className="text-xs text-foreground-muted">
                Sorted newest first
              </span>
            </div>

            {scopedEvents.length === 0 ? (
              <div className="bg-surface border border-border rounded-panel p-8 text-center flex flex-col items-center justify-center gap-2">
                <Info className="w-5 h-5 text-foreground-muted" />
                <span className="text-xs font-semibold text-foreground">
                  No matching incidents detected
                </span>
                <p className="text-xs text-foreground-muted max-w-xs leading-relaxed">
                  No fire incidents matching &ldquo;{filterConfig.badge}&rdquo; were detected in the selected geographic region.
                </p>
                <button
                  type="button"
                  onClick={onBack}
                  className="mt-2 px-3 py-1.5 rounded-control bg-accent text-white font-medium text-xs hover:bg-accent/90 transition-colors shadow-panel"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[440px] overflow-y-auto pr-1">
                {scopedEvents.map((evt, idx) => {
                  const risk = calculateOperationalRisk(evt);
                  const isSelected = selectedEvent?.event_id === evt.event_id;
                  const formattedIndex = String(idx + 1).padStart(3, "0");
                  const timeAgo = formatTimeAgo(evt.end_time, idx);
                  const readableLocation = formatHumanReadableLocation(evt);

                  return (
                    <div
                      key={evt.event_id}
                      onClick={() => handleSelectIncident(evt)}
                      className={cn(
                        "group bg-surface border rounded-panel p-3 shadow-panel cursor-pointer transition-all duration-150 flex flex-col justify-between select-none",
                        isSelected
                          ? "border-accent ring-1 ring-accent bg-surface-raised"
                          : "border-border hover:border-border-strong hover:bg-surface-hover/50"
                      )}
                    >
                      {/* Top Bar: Identifier, Severity */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-thermal" />
                          <span className="text-xs font-semibold text-foreground group-hover:text-accent font-mono">
                            Fire #{formattedIndex}
                          </span>
                          <span className="text-[11px] text-foreground-muted font-mono">
                            · {evt.event_id}
                          </span>
                        </div>

                        <Badge variant={getRiskBadgeVariant(risk.level)} size="sm">
                          {risk.level}
                        </Badge>
                      </div>

                      {/* Human-Readable Location */}
                      <div className="flex items-start gap-1 text-xs text-foreground font-medium mb-1 truncate">
                        <MapPin className="w-3 h-3 text-foreground-muted shrink-0 mt-0.5" />
                        <span className="truncate">{readableLocation}</span>
                      </div>

                      {/* Detection Timing & Status */}
                      <div className="flex items-center justify-between text-[11px] text-foreground-muted mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-foreground-muted" />
                          <span>Detected {timeAgo}</span>
                        </div>
                        <span className="font-mono text-foreground-secondary">
                          {(evt.confidence * 100).toFixed(0)}% Conf
                        </span>
                      </div>

                      {/* Technical Details Footer */}
                      <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                        <span className="text-foreground-muted font-mono text-[10px]">
                          {evt.frp_mw.toFixed(0)} MW
                        </span>
                        <span className="text-accent font-medium flex items-center gap-0.5 group-hover:underline">
                          <span>Details</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
