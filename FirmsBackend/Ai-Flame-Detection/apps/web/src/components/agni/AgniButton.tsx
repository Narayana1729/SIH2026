"use client";

import React from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import { AgniStatus } from "@/services/agni/agniTypes";
import { cn } from "@/lib/utils";

export interface AgniButtonProps {
  status: AgniStatus;
  isOpen: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function AgniButton({
  status,
  isOpen,
  onClick,
  className,
  disabled = false,
}: AgniButtonProps) {
  const isListening = status === "listening";
  const isProcessing = status === "processing" || status === "activating";
  const isSpeaking = status === "speaking";
  const isError = status === "error";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="AGNI Voice Intelligence Console"
      aria-expanded={isOpen}
      aria-controls="agni-console-panel"
      className={cn(
        "relative flex items-center gap-1.5 px-2.5 py-1 rounded-control text-xs font-sans font-medium transition-colors select-none shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        // Styling according to status & open state
        isOpen || isListening || isSpeaking
          ? "bg-accent text-white"
          : isProcessing
          ? "bg-accent/10 border border-accent text-accent"
          : isError
          ? "bg-state-error/10 border border-state-error text-state-error"
          : "bg-surface-raised hover:bg-surface-hover border border-border text-foreground",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Tactical Icon */}
      {isListening ? (
        <Radio className="w-3.5 h-3.5" />
      ) : isError ? (
        <MicOff className="w-3.5 h-3.5 text-state-error" />
      ) : (
        <Mic
          className={cn(
            "w-3.5 h-3.5 transition-colors",
            isSpeaking || isOpen ? "text-white" : isProcessing ? "text-accent" : "text-foreground-secondary"
          )}
        />
      )}

      {/* Brand Identity */}
      <span className="font-semibold text-xs">AGNI</span>

      {/* Active Pulse Dot */}
      {(isListening || isSpeaking || isProcessing) && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              isProcessing ? "bg-accent-cyan" : "bg-accent"
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-1.5 w-1.5",
              isProcessing ? "bg-accent-cyan" : "bg-accent"
            )}
          />
        </span>
      )}
    </button>
  );
}
