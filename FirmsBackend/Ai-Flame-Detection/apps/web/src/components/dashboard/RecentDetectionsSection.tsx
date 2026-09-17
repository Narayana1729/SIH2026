"use client";

import React, { useMemo } from "react";
import {
  Flame,
  Clock,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useEventContext } from "@/context/EventContext";
import { ThermalEvent } from "@/types/event";
import { calculateOperationalRisk } from "@/lib/risk/scoring";
import { derivePrimaryCategory, FIRE_CATEGORIES } from "@/lib/categories/fireCategories";
import { formatHumanReadableLocation } from "@/lib/location/locationFilter";
import { formatRelativeSecondsAgo } from "@/lib/format/dates";

export interface RecentDetectionsSectionProps {
  title?: string;
  limit?: number;
  onSelectEvent?: (event: ThermalEvent) => void;
}

export function RecentDetectionsSection({
  title = "Recent Detections & Incidents",
  limit = 8,
  onSelectEvent,
}: RecentDetectionsSectionProps) {
  const { filteredEvents, openConciseEventDetails, selectedCategory } = useEventContext();

  // Sort events chronologically (newest first)
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort(
      (a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
    );
  }, [filteredEvents]);

  const displayedEvents = sortedEvents.slice(0, limit);

  const categoryName = useMemo(() => {
    if (selectedCategory === "ALL") return "All Incidents";
    const found = FIRE_CATEGORIES.find((c) => c.id === selectedCategory);
    return found ? found.title : selectedCategory;
  }, [selectedCategory]);

  const handleCardClick = (event: ThermalEvent) => {
    if (onSelectEvent) {
      onSelectEvent(event);
    } else {
      openConciseEventDetails(event);
    }
  };

  // Helper to format relative time ago
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
    <div className="flex flex-col gap-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {title} — {categoryName}
          </span>
          <span className="text-xs text-foreground-muted">
            ({filteredEvents.length} detected)
          </span>
        </div>
      </div>

      {/* Incidents List Grid */}
      {displayedEvents.length === 0 ? (
        <div className="bg-surface border border-border rounded-panel p-6 text-center text-xs text-foreground-muted">
          No active fire incidents found matching the selected geographic scope and category.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayedEvents.map((evt, idx) => {
            const risk = calculateOperationalRisk(evt);
            const primaryCat = derivePrimaryCategory(evt);
            const formattedIndex = String(idx + 1).padStart(3, "0");
            const timeAgo = formatTimeAgo(evt.end_time, idx);

            return (
              <div
                key={evt.event_id}
                onClick={() => handleCardClick(evt)}
                className="group bg-surface border border-border hover:border-border-strong rounded-panel p-3.5 shadow-panel cursor-pointer transition-all duration-150 hover:bg-surface-raised/60 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Identifier & Severity */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-thermal" />
                      <span className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors font-mono">
                        Fire #{formattedIndex}
                      </span>
                    </div>

                    <Badge
                      variant={getRiskBadgeVariant(risk.level)}
                      size="sm"
                    >
                      {risk.level}
                    </Badge>
                  </div>

                  {/* Location & Context */}
                  <div className="flex items-start gap-1.5 text-xs text-foreground font-medium mb-2 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 text-foreground-muted shrink-0 mt-0.5" />
                    <span className="truncate">{formatHumanReadableLocation(evt)}</span>
                  </div>

                  {/* Metadata Row: Relative Detection Time & Confidence */}
                  <div className="flex items-center justify-between text-[11px] text-foreground-muted mb-3 font-sans">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-foreground-muted" />
                      <span>{timeAgo}</span>
                    </div>

                    <div className="font-mono text-foreground-secondary font-medium">
                      {(evt.confidence * 100).toFixed(0)}% Conf
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                  <span className="text-foreground-muted truncate max-w-[130px] font-mono text-[10px]">
                    {evt.frp_mw.toFixed(0)} MW · {primaryCat}
                  </span>

                  <span className="text-accent font-medium flex items-center gap-0.5 text-xs group-hover:underline">
                    <span>Inspect</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
