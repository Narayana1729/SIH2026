"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
  PositionMode,
  OverlayPosition,
  StoredOverlayPositionsV1,
  UseOverlayPositionOptions,
  UseOverlayPositionResult,
} from "@/types/overlay";
import { Z_INDEX } from "@/config/zIndex";

const STORAGE_KEY = "pyrosat:overlay-positions:v1";
const DEFAULT_ALLOWED_MODES: PositionMode[] = [
  "docked-bl",
  "docked-br",
  "docked-tl",
  "docked-tr",
  "floating",
];

const CORNER_SNAP_THRESHOLD = 52; // pixels from corner to trigger dock snapping

function loadStoredPosition(id: string): OverlayPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredOverlayPositionsV1 = JSON.parse(raw);
    if (parsed.version === 1 && parsed.overlays && parsed.overlays[id]) {
      return parsed.overlays[id];
    }
  } catch {
    // Ignore parse errors and use fallback
  }
  return null;
}

function saveStoredPosition(id: string, position: OverlayPosition) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let store: StoredOverlayPositionsV1 = { version: 1, overlays: {} };
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.version === 1 && parsed.overlays) {
          store = parsed;
        }
      } catch {
        // use clean store
      }
    }
    store.overlays[id] = position;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota or security errors
  }
}

export function useOverlayPosition({
  id,
  defaultPosition,
  defaultMode,
  defaultCoordinates,
  allowedModes = DEFAULT_ALLOWED_MODES,
  boundsOffset = {},
}: UseOverlayPositionOptions): UseOverlayPositionResult {
  const resolvedDefault = defaultPosition || defaultMode || "docked-br";
  const bounds = useMemo(
    () => ({
      top: boundsOffset.top ?? 56,
      bottom: boundsOffset.bottom ?? 64,
      left: boundsOffset.left ?? 12,
      right: boundsOffset.right ?? 12,
    }),
    [boundsOffset.top, boundsOffset.bottom, boundsOffset.left, boundsOffset.right]
  );

  // Initialize mode and coordinates from storage or defaults
  const initialMode = useMemo<PositionMode>(() => {
    const stored = loadStoredPosition(id);
    if (stored?.mode && allowedModes.includes(stored.mode)) {
      return stored.mode;
    }
    return resolvedDefault;
  }, [id, allowedModes, resolvedDefault]);

  const [mode, setModeState] = useState<PositionMode>(initialMode);
  const [lastDockedMode, setLastDockedMode] = useState<PositionMode>(
    initialMode !== "floating" ? initialMode : resolvedDefault
  );

  const [coords, setCoords] = useState<{ x: number; y: number }>(() => {
    const stored = loadStoredPosition(id);
    if (typeof stored?.x === "number" && typeof stored?.y === "number") {
      return { x: stored.x, y: stored.y };
    }
    if (defaultCoordinates) {
      return typeof defaultCoordinates === "function"
        ? defaultCoordinates()
        : defaultCoordinates;
    }
    return { x: 24, y: 80 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Clamp coordinates within reachable viewport bounds
  const clampCoordinates = useCallback(
    (pos: { x: number; y: number }) => {
      if (typeof window === "undefined") return pos;
      const width = cardRef.current?.offsetWidth || 340;
      const height = cardRef.current?.offsetHeight || 280;
      const maxX = Math.max(bounds.left, window.innerWidth - width - bounds.right);
      const maxY = Math.max(bounds.top, window.innerHeight - height - bounds.bottom);

      return {
        x: Math.min(Math.max(bounds.left, pos.x), maxX),
        y: Math.min(Math.max(bounds.top, pos.y), maxY),
      };
    },
    [bounds]
  );

  // Re-clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      if (mode === "floating") {
        setCoords((prev) => clampCoordinates(prev));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampCoordinates, mode]);

  // Update mode with persistence
  const setMode = useCallback(
    (newMode: PositionMode) => {
      if (!allowedModes.includes(newMode)) return;
      setModeState(newMode);
      if (newMode !== "floating") {
        setLastDockedMode(newMode);
      }
      saveStoredPosition(id, {
        mode: newMode,
        x: coords.x,
        y: coords.y,
      });
    },
    [id, allowedModes, coords]
  );

  // Cycle through allowed modes
  const cycleMode = useCallback(() => {
    const currentIdx = allowedModes.indexOf(mode);
    const nextIdx = currentIdx === -1 || currentIdx >= allowedModes.length - 1 ? 0 : currentIdx + 1;
    setMode(allowedModes[nextIdx]);
  }, [allowedModes, mode, setMode]);

  // Toggle between floating and docked
  const toggleFloating = useCallback(() => {
    if (mode === "floating") {
      setMode(lastDockedMode);
    } else {
      if (allowedModes.includes("floating")) {
        // If switching to floating from docked, set initial coordinates to current card rect
        if (cardRef.current && typeof window !== "undefined") {
          const rect = cardRef.current.getBoundingClientRect();
          setCoords(clampCoordinates({ x: rect.left, y: rect.top }));
        }
        setMode("floating");
      }
    }
  }, [mode, lastDockedMode, allowedModes, clampCoordinates, setMode]);

  // Reset to default position
  const resetPosition = useCallback(() => {
    setModeState(resolvedDefault);
    if (resolvedDefault !== "floating") {
      setLastDockedMode(resolvedDefault);
    }
    const defaultC = defaultCoordinates
      ? typeof defaultCoordinates === "function"
        ? defaultCoordinates()
        : defaultCoordinates
      : { x: 24, y: 80 };
    setCoords(defaultC);
    saveStoredPosition(id, {
      mode: resolvedDefault,
      x: defaultC.x,
      y: defaultC.y,
    });
  }, [resolvedDefault, defaultCoordinates, id]);

  // Pointer drag handler (attached to drag handle GripVertical)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      // If currently docked, transition to floating using current rendered bounding box
      let startPos = coords;
      if (mode !== "floating" && cardRef.current && typeof window !== "undefined") {
        const rect = cardRef.current.getBoundingClientRect();
        startPos = clampCoordinates({ x: rect.left, y: rect.top });
        setCoords(startPos);
        setModeState("floating");
      }

      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: startPos.x,
        initialY: startPos.y,
      };
      setIsDragging(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!dragStartRef.current) return;
        const dx = moveEvent.clientX - dragStartRef.current.startX;
        const dy = moveEvent.clientY - dragStartRef.current.startY;
        const rawPos = {
          x: dragStartRef.current.initialX + dx,
          y: dragStartRef.current.initialY + dy,
        };
        const clamped = clampCoordinates(rawPos);
        setCoords(clamped);
      };

      const onPointerUp = () => {
        setIsDragging(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);

        if (!cardRef.current || typeof window === "undefined") return;
        const rect = cardRef.current.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Check for corner snapping if allowed
        let snappedMode: PositionMode | null = null;
        if (
          allowedModes.includes("docked-tl") &&
          rect.top <= bounds.top + CORNER_SNAP_THRESHOLD &&
          rect.left <= bounds.left + CORNER_SNAP_THRESHOLD
        ) {
          snappedMode = "docked-tl";
        } else if (
          allowedModes.includes("docked-tr") &&
          rect.top <= bounds.top + CORNER_SNAP_THRESHOLD &&
          rect.right >= winW - bounds.right - CORNER_SNAP_THRESHOLD
        ) {
          snappedMode = "docked-tr";
        } else if (
          allowedModes.includes("docked-bl") &&
          rect.bottom >= winH - bounds.bottom - CORNER_SNAP_THRESHOLD &&
          rect.left <= bounds.left + CORNER_SNAP_THRESHOLD
        ) {
          snappedMode = "docked-bl";
        } else if (
          allowedModes.includes("docked-br") &&
          rect.bottom >= winH - bounds.bottom - CORNER_SNAP_THRESHOLD &&
          rect.right >= winW - bounds.right - CORNER_SNAP_THRESHOLD
        ) {
          snappedMode = "docked-br";
        } else if (
          allowedModes.includes("docked-bc") &&
          rect.bottom >= winH - bounds.bottom - CORNER_SNAP_THRESHOLD &&
          Math.abs(rect.left + rect.width / 2 - winW / 2) <= CORNER_SNAP_THRESHOLD * 2
        ) {
          snappedMode = "docked-bc";
        } else if (
          allowedModes.includes("docked-tc") &&
          rect.top <= bounds.top + CORNER_SNAP_THRESHOLD &&
          Math.abs(rect.left + rect.width / 2 - winW / 2) <= CORNER_SNAP_THRESHOLD * 2
        ) {
          snappedMode = "docked-tc";
        }

        const finalMode = snappedMode || "floating";
        setModeState(finalMode);
        if (finalMode !== "floating") {
          setLastDockedMode(finalMode);
        }
        saveStoredPosition(id, {
          mode: finalMode,
          x: coords.x,
          y: coords.y,
        });

        dragStartRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [allowedModes, bounds, clampCoordinates, coords, id, mode]
  );

  // Compute CSS positioning styles and classes
  const containerStyle = useMemo<React.CSSProperties>(() => {
    if (mode === "floating") {
      return {
        position: "fixed",
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        zIndex: isDragging ? Z_INDEX.activeOverlay : Z_INDEX.overlays,
        pointerEvents: "auto",
      };
    }
    return {
      zIndex: isDragging ? Z_INDEX.activeOverlay : Z_INDEX.overlays,
      pointerEvents: "auto",
    };
  }, [mode, coords.x, coords.y, isDragging]);

  const containerClassName = useMemo(() => {
    if (mode === "floating") {
      return "pointer-events-auto transition-shadow";
    }
    switch (mode) {
      case "docked-bl":
        return "fixed sm:absolute bottom-0 sm:bottom-6 left-0 sm:left-3 pointer-events-auto";
      case "docked-br":
        return "fixed sm:absolute bottom-0 sm:bottom-6 right-0 sm:right-3 pointer-events-auto";
      case "docked-tl":
        return "fixed sm:absolute top-14 sm:top-16 left-0 sm:left-3 pointer-events-auto";
      case "docked-tr":
        return "fixed sm:absolute top-14 sm:top-16 right-0 sm:right-3 pointer-events-auto";
      case "docked-bc":
        return "fixed sm:absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto";
      case "docked-tc":
        return "fixed sm:absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 pointer-events-auto";
      default:
        return "pointer-events-auto";
    }
  }, [mode]);

  return {
    mode,
    position: coords,
    isDragging,
    cardRef,
    handlePointerDown,
    setMode,
    cycleMode,
    toggleFloating,
    resetPosition,
    containerStyle,
    style: containerStyle,
    containerClassName,
  };
}
