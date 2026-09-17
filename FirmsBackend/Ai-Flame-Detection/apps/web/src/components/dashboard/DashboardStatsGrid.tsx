"use client";

import React from "react";
import { Flame, Clock, AlertTriangle, MapPin, Zap, ArrowUpRight } from "lucide-react";
import { useEventContext } from "@/context/EventContext";
import { formatCompactCount } from "@/lib/format/numbers";
import { cn } from "@/lib/utils";

export function DashboardStatsGrid() {
  const { stats, selectedState, activeMetricFilter, handleMetricCardClick } = useEventContext();

  const cards = [
    {
      id: "active-fires",
      label: "Active Fires",
      value: stats.total,
      subtext: selectedState !== "ALL" ? `In ${selectedState}` : "In Selected Scope",
      icon: Flame,
      isActive: activeMetricFilter === "ACTIVE_FIRES",
    },
    {
      id: "detected-today",
      label: "Detected Today",
      value: stats.detectedToday,
      subtext: "Last 24 Hours",
      icon: Clock,
      isActive: activeMetricFilter === "DETECTED_TODAY",
    },
    {
      id: "high-severity",
      label: "High / Critical",
      value: stats.critical + stats.high,
      subtext: `${stats.critical} Critical · ${stats.high} High`,
      icon: AlertTriangle,
      isActive: activeMetricFilter === "HIGH_CRITICAL",
      badgeVariant: "error",
    },
    {
      id: "regions-affected",
      label: "Regions Affected",
      value: stats.affectedRegionsCount,
      subtext: selectedState !== "ALL" ? `${selectedState} Districts` : "Active Locations",
      icon: MapPin,
      isActive: activeMetricFilter === "REGIONS_AFFECTED",
    },
    {
      id: "max-frp",
      label: "Peak Intensity",
      value: `${stats.maxFrp.toFixed(0)} MW`,
      subtext: "Fire Radiative Power",
      icon: Zap,
      isActive: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 font-sans">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => handleMetricCardClick(card.id)}
            className={cn(
              "group text-left relative bg-surface border border-border rounded-panel p-3.5 shadow-panel flex flex-col justify-between transition-all duration-150 hover:bg-surface-hover/50 hover:border-border-strong cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20",
              card.isActive
                ? "border-accent ring-1 ring-accent bg-surface-raised"
                : ""
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2 w-full">
              <span className="text-xs font-medium text-foreground-muted group-hover:text-foreground transition-colors">
                {card.label}
              </span>
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-6 h-6 rounded-control bg-surface-raised border border-border flex items-center justify-center text-foreground-secondary group-hover:text-foreground transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground leading-none mb-1">
                {typeof card.value === "number" ? formatCompactCount(card.value) : card.value}
              </span>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-foreground-muted truncate">
                  {card.subtext}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
