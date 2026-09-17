"use client";

import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { ThermalEvent } from "@/types/event";
import { cn } from "@/lib/utils";

export interface GlobeViewProps {
  initialLat?: number;
  initialLng?: number;
  events?: ThermalEvent[];
  selectedEvent?: ThermalEvent | null;
  isVisible?: boolean;
  onSelectEvent?: (event: ThermalEvent) => void;
  onCameraChange?: (lat: number, lng: number, altitude: number) => void;
  onSwitchTo2D?: () => void;
  className?: string;
}

export interface GlobeViewHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  flyToCoordinates: (lat: number, lng: number, altitudeMeters?: number) => void;
  getViewer: () => any;
}

export const GlobeView = forwardRef<GlobeViewHandle, GlobeViewProps>(
  function GlobeView(
    {
      selectedEvent,
      className,
    }: GlobeViewProps,
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Expose Imperative Navigation Handle
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          try {
            iframeRef.current?.contentWindow?.postMessage({ type: "ZOOM_IN" }, "*");
          } catch {}
        },
        zoomOut: () => {
          try {
            iframeRef.current?.contentWindow?.postMessage({ type: "ZOOM_OUT" }, "*");
          } catch {}
        },
        resetView: () => {
          try {
            iframeRef.current?.contentWindow?.postMessage({ type: "RESET_VIEW" }, "*");
          } catch {}
        },
        flyToCoordinates: (lat: number, lng: number, altitudeMeters = 80000) => {
          try {
            iframeRef.current?.contentWindow?.postMessage(
              { type: "FLY_TO", lat, lng, altitude: altitudeMeters },
              "*"
            );
          } catch {}
        },
        getViewer: () => null,
      }),
      []
    );

    const srcUrl = selectedEvent
      ? `http://localhost:8081/#lat=${selectedEvent.latitude}&lon=${selectedEvent.longitude}&alt=85000&heading=0&pitch=-55&style=normal&bloom=1&hud=tactical`
      : "http://localhost:8081/#lat=20.5937&lon=78.9629&alt=4500000&heading=0&pitch=-78&style=normal&bloom=1&hud=tactical";

    return (
      <div className={cn("relative w-full h-full overflow-hidden select-none bg-[#0a0d14]", className)}>
        {/* Exact sriVision Map & UI Engine */}
        <iframe
          ref={iframeRef}
          src={srcUrl}
          className="w-full h-full border-0"
          allow="fullscreen; accelerometer; gyroscope; microphone; geolocation"
          title="sriVision 3D Command Platform"
        />
      </div>
    );
  }
);
