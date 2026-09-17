"use client";

import React, { useState } from "react";
import { Check, ShieldCheck, UserCheck, RefreshCw, AlertTriangle, Building2, Trees, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { saveOperatorFeedback, getEventFeedback, getModelGovernanceStats, type OperatorLabel } from "@/lib/feedback/feedbackStore";

interface OperatorFeedbackWidgetProps {
  eventId: string;
  className?: string;
}

export function OperatorFeedbackWidget({ eventId, className }: OperatorFeedbackWidgetProps) {
  const [existingFeedback, setExistingFeedback] = useState(() => getEventFeedback(eventId));
  const [isSaved, setIsSaved] = useState(false);
  const stats = getModelGovernanceStats();

  const handleVerify = (label: OperatorLabel) => {
    const saved = saveOperatorFeedback(eventId, label, "Operator manual verification");
    setExistingFeedback(saved);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className={`p-3 rounded-panel bg-surface-raised border border-border space-y-2.5 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Human-in-the-Loop Operator Verification</span>
        </div>
        <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
          {stats.modelVersion}
        </Badge>
      </div>

      <p className="text-[11px] text-foreground-secondary leading-normal">
        Validate satellite detection and ML classification. Confirmed labels feed into the active learning store for model retraining.
      </p>

      {/* Verification Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <button
          onClick={() => handleVerify("VERIFIED_INDUSTRIAL")}
          className={`px-2 py-1.5 rounded-control text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
            existingFeedback?.verifiedLabel === "VERIFIED_INDUSTRIAL"
              ? "bg-accent/15 border-accent text-accent font-semibold"
              : "bg-surface hover:bg-surface-hover border-border text-foreground"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-accent" />
          <span>Industrial</span>
        </button>

        <button
          onClick={() => handleVerify("VERIFIED_WILDFIRE")}
          className={`px-2 py-1.5 rounded-control text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
            existingFeedback?.verifiedLabel === "VERIFIED_WILDFIRE"
              ? "bg-state-error/15 border-state-error text-state-error font-semibold"
              : "bg-surface hover:bg-surface-hover border-border text-foreground"
          }`}
        >
          <Trees className="w-3.5 h-3.5 text-state-error" />
          <span>Wildfire</span>
        </button>

        <button
          onClick={() => handleVerify("VERIFIED_AGRICULTURAL")}
          className={`px-2 py-1.5 rounded-control text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
            existingFeedback?.verifiedLabel === "VERIFIED_AGRICULTURAL"
              ? "bg-state-warning/15 border-state-warning text-state-warning font-semibold"
              : "bg-surface hover:bg-surface-hover border-border text-foreground"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-state-warning" />
          <span>Agricultural</span>
        </button>

        <button
          onClick={() => handleVerify("CONFIRMED_FALSE_POSITIVE")}
          className={`px-2 py-1.5 rounded-control text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
            existingFeedback?.verifiedLabel === "CONFIRMED_FALSE_POSITIVE"
              ? "bg-state-error/15 border-state-error text-state-error font-semibold"
              : "bg-surface hover:bg-surface-hover border-border text-foreground"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-state-error" />
          <span>False Alarm</span>
        </button>
      </div>

      {/* Status banner */}
      {existingFeedback && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-control bg-state-success/10 border border-state-success/30 text-xs text-state-success">
          <span className="flex items-center gap-1.5 font-medium">
            <Check className="w-3.5 h-3.5" />
            Confirmed as {existingFeedback.verifiedLabel.replace("VERIFIED_", "").replace("CONFIRMED_", "")}
          </span>
          <span className="text-[10px] text-foreground-muted font-mono">
            {new Date(existingFeedback.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Model Governance Telemetry */}
      <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-state-success" />
          Active Model: <strong className="text-foreground font-medium">{stats.modelVersion}</strong>
        </span>
        <span className="font-mono">
          {stats.totalVerifiedIncidentsCount.toLocaleString()} Verified Training Incidents
        </span>
      </div>
    </div>
  );
}
