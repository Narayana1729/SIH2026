"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  X,
  Flame,
  AlertTriangle,
  Radio,
  CheckCircle2,
  MapPin,
  ExternalLink,
  Trash2,
  Check,
  Clock,
} from "lucide-react";
import { useEventContext, AlertNotification } from "@/context/EventContext";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { formatUtcDateTime } from "@/lib/format/dates";

export interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SeverityFilter = "ALL" | "CRITICAL" | "HIGH" | "WARNING";

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const {
    alerts,
    unreadAlertCount,
    acknowledgeAlert,
    clearAllAlerts,
    inspectEventOnMap,
  } = useEventContext();

  const [selectedSeverity, setSelectedSeverity] = useState<SeverityFilter>("ALL");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter((alert) => {
    if (selectedSeverity === "ALL") return true;
    return alert.severity === selectedSeverity;
  });

  const getSeverityBadge = (severity: AlertNotification["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge variant="error">CRITICAL</Badge>;
      case "HIGH":
        return <Badge variant="warning">HIGH</Badge>;
      case "WARNING":
        return <Badge variant="thermal">WARNING</Badge>;
      default:
        return <Badge variant="neutral">INFO</Badge>;
    }
  };

  const getAlertIcon = (type: AlertNotification["type"]) => {
    switch (type) {
      case "THERMAL_CRITICAL":
        return <Flame className="w-4 h-4 text-rose-500" />;
      case "HIGH_FRP":
      case "UNACK_INDUSTRIAL":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "SATELLITE_BLIND_WINDOW":
        return <Radio className="w-4 h-4 text-sky-400" />;
      default:
        return <Bell className="w-4 h-4 text-accent" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Active Notifications and Operational Alerts"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-2xl bg-surface border border-border rounded-panel shadow-elevated overflow-hidden flex flex-col max-h-[85vh] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-control bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Active Alerts & Incident Feed
                </h2>
                {unreadAlertCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                    {unreadAlertCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-foreground-muted">
                Real-time thermal anomalies, satellite revisit gaps, and priority telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadAlertCount > 0 && (
              <button
                onClick={clearAllAlerts}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-foreground-secondary hover:text-foreground bg-surface hover:bg-surface-hover border border-border rounded-control transition-colors"
                title="Mark all active alerts as acknowledged"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Acknowledge All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-foreground-muted hover:text-foreground rounded-control hover:bg-surface-hover transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border text-xs">
          <div className="flex items-center gap-1">
            {(["ALL", "CRITICAL", "HIGH", "WARNING"] as SeverityFilter[]).map((sev) => {
              const isSelected = selectedSeverity === sev;
              const count =
                sev === "ALL"
                  ? alerts.length
                  : alerts.filter((a) => a.severity === sev).length;
              return (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={cn(
                    "px-2.5 py-1 rounded-control text-xs font-medium transition-all",
                    isSelected
                      ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                      : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover border border-transparent"
                  )}
                >
                  {sev} ({count})
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-foreground-muted hidden sm:block">
            {filteredAlerts.length} item{filteredAlerts.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredAlerts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-foreground-muted">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mb-2" />
              <div className="text-sm font-medium text-foreground">No Unacknowledged Alerts</div>
              <p className="text-xs text-foreground-muted max-w-sm mt-0.5">
                All high-priority thermal events and satellite blind window advisories have been acknowledged.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "p-3 rounded-panel border transition-all duration-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
                  alert.acknowledged
                    ? "bg-surface/50 border-border/60 opacity-70"
                    : alert.severity === "CRITICAL"
                    ? "bg-rose-500/5 border-rose-500/30"
                    : alert.severity === "HIGH"
                    ? "bg-amber-500/5 border-amber-500/30"
                    : "bg-surface border-border"
                )}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {alert.title}
                      </span>
                      {getSeverityBadge(alert.severity)}
                      {alert.acknowledged && (
                        <span className="text-[10px] text-foreground-muted bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                          ACKNOWLEDGED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground-secondary line-clamp-2">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-foreground-muted">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {formatUtcDateTime(alert.timestamp)}
                      </span>
                      {alert.event_id && (
                        <span className="font-mono text-[10px] text-accent">
                          ID: {alert.event_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded-control bg-surface hover:bg-surface-hover text-foreground-secondary hover:text-foreground border border-border transition-colors"
                      title="Acknowledge alert"
                    >
                      Acknowledge
                    </button>
                  )}

                  {alert.event_id && (
                    <button
                      onClick={() => {
                        inspectEventOnMap(alert.event_id!);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-control bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm"
                      title="Inspect event on Geospatial Map"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Inspect on Map</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-surface-raised flex items-center justify-between text-xs text-foreground-muted shrink-0">
          <span>Continuous LEO thermal monitoring active (NOAA-20 / SNPP VIIRS)</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-surface hover:bg-surface-hover text-foreground font-medium rounded-control border border-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
