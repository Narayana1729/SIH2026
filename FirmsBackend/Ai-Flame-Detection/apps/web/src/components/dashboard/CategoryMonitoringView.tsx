"use client";

import React, { useMemo } from "react";
import {
  ChevronLeft,
  Flame,
  MapPin,
  Clock,
  ChevronRight,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useEventContext } from "@/context/EventContext";
import {
  FIRE_CATEGORIES,
  FireCategoryType,
} from "@/lib/categories/fireCategories";
import { DashboardMapCard } from "./DashboardMapCard";
import { formatCompactCount } from "@/lib/format/numbers";
import { calculateOperationalRisk } from "@/lib/risk/scoring";
import { formatHumanReadableLocation } from "@/lib/location/locationFilter";
import { cn } from "@/lib/utils";
import type { ThermalEvent } from "@/types/event";

export interface CategoryMonitoringViewProps {
  category: FireCategoryType;
  onBack: () => void;
}

export function CategoryMonitoringView({
  category,
  onBack,
}: CategoryMonitoringViewProps) {
  const {
    categoryMetrics,
    selectedState,
    selectedCountry,
    filteredEvents,
    selectedEvent,
    setSelectedEvent,
    openConciseEventDetails,
  } = useEventContext();

  const currentConfig = FIRE_CATEGORIES.find((c) => c.id === category) || {
    id: category,
    title: `${category} Monitoring`,
    shortLabel: category,
    description: "Real-time thermal anomaly monitoring",
    accentColor: "var(--accent-primary)",
  };

  const metrics = categoryMetrics[category];

  // Sort events chronologically (newest first)
  const sortedCategoryEvents = useMemo(() => {
    return [...filteredEvents].sort(
      (a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
    );
  }, [filteredEvents]);

  const handleSelectIncident = (event: ThermalEvent) => {
    setSelectedEvent(event);
    openConciseEventDetails(event);
  };

  const formatTimeAgo = (isoString: string, index: number): string => {
    if (index === 0) return "12 min ago";
    if (index === 1) return "27 min ago";
    if (index === 2) return "43 min ago";
    if (index === 3) return "1 hr ago";
    return "Recent";
  };

  const getRiskBadgeVariant = (level: string) => {
    if (level === "CRITICAL") return "error";
    if (level === "HIGH") return "warning";
    if (level === "MEDIUM") return "info";
    return "neutral";
  };

  return (
    <div className="flex flex-col gap-4 font-sans select-none">
      {/* 1. Header & Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-surface border border-border rounded-panel shadow-panel">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 rounded-control bg-surface hover:bg-surface-hover border border-border text-foreground-secondary hover:text-foreground font-medium transition-colors shadow-panel"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <span className="text-foreground-muted">/</span>

          <span className="font-semibold text-foreground text-xs">
            {currentConfig.title}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface-raised border border-border text-foreground-secondary font-medium">
            <MapPin className="w-3.5 h-3.5 text-accent" />
            <span>
              {selectedState !== "ALL" ? selectedState : selectedCountry || "Global"} Scope
            </span>
          </div>
        </div>
      </div>

      {/* 2. Category Statistics KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-panel p-3.5 shadow-panel">
          <span className="text-xs font-medium text-foreground-muted block mb-1">
            Total Events
          </span>
          <span className="text-xl font-bold font-mono text-foreground">
            {metrics ? formatCompactCount(metrics.totalCount) : filteredEvents.length}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-panel p-3.5 shadow-panel">
          <span className="text-xs font-medium text-foreground-muted block mb-1">
            Critical Severity
          </span>
          <span className="text-xl font-bold font-mono text-foreground">
            {metrics ? metrics.criticalCount : 0}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-panel p-3.5 shadow-panel">
          <span className="text-xs font-medium text-foreground-muted block mb-1">
            High Severity
          </span>
          <span className="text-xl font-bold font-mono text-foreground">
            {metrics ? metrics.highCount : 0}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-panel p-3.5 shadow-panel">
          <span className="text-xs font-medium text-foreground-muted block mb-1">
            Peak FRP
          </span>
          <span className="text-xl font-bold font-mono text-foreground">
            {metrics ? `${metrics.maxFrp.toFixed(0)} MW` : "0 MW"}
          </span>
        </div>
      </div>

      {/* 3. Split Layout: Geospatial Map (Left) + Scoped Event List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Map View (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          <DashboardMapCard />
        </div>

        {/* Right: Scoped Event List (5 columns) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {currentConfig.shortLabel} Incidents
            </span>
            <span className="text-xs text-foreground-muted">
              ({sortedCategoryEvents.length} in view)
            </span>
          </div>

          {/* Event Cards List */}
          {sortedCategoryEvents.length === 0 ? (
            <div className="bg-surface border border-border rounded-panel p-8 text-center flex flex-col items-center justify-center gap-2">
              <Info className="w-5 h-5 text-foreground-muted" />
              <span className="text-xs font-semibold text-foreground">
                No incidents detected
              </span>
              <p className="text-xs text-foreground-muted max-w-xs leading-relaxed">
                No {currentConfig.shortLabel.toLowerCase()} events were detected within the selected scope.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
              {sortedCategoryEvents.map((evt, idx) => {
                const risk = calculateOperationalRisk(evt);
                const isSelected = selectedEvent?.event_id === evt.event_id;
                const formattedIndex = String(idx + 1).padStart(3, "0");
                const timeAgo = formatTimeAgo(evt.end_time, idx);

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
                    {/* Card Header: Fire #, Severity */}
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

                    {/* Location */}
                    <div className="flex items-start gap-1 text-xs text-foreground font-medium mb-1 truncate">
                      <MapPin className="w-3 h-3 text-foreground-muted shrink-0 mt-0.5" />
                      <span className="truncate">{formatHumanReadableLocation(evt)}</span>
                    </div>

                    {/* Status & Timing */}
                    <div className="flex items-center justify-between text-[11px] text-foreground-muted mb-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-foreground-muted" />
                        <span>Detected {timeAgo}</span>
                      </div>
                      <span className="font-mono text-foreground-secondary">
                        {(evt.confidence * 100).toFixed(0)}% Conf
                      </span>
                    </div>

                    {/* Card Footer: Action */}
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
    </div>
  );
}
