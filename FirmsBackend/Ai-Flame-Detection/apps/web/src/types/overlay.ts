/**
 * Universal Overlay Positioning System Types
 */

export type PositionMode =
  | "docked-bl"
  | "docked-br"
  | "docked-tl"
  | "docked-tr"
  | "docked-bc"
  | "docked-tc"
  | "floating";

export interface OverlayPosition {
  mode: PositionMode;
  x?: number;
  y?: number;
}

export interface StoredOverlayPositionsV1 {
  version: 1;
  overlays: Record<string, OverlayPosition>;
}

export interface OverlayBoundsOffset {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface UseOverlayPositionOptions {
  id: string;
  defaultPosition?: PositionMode;
  defaultMode?: PositionMode;
  defaultCoordinates?: { x: number; y: number } | (() => { x: number; y: number });
  allowedModes?: PositionMode[];
  boundsOffset?: OverlayBoundsOffset;
}

export interface UseOverlayPositionResult {
  mode: PositionMode;
  position: { x: number; y: number };
  isDragging: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  handlePointerDown: (e: React.PointerEvent) => void;
  setMode: (mode: PositionMode) => void;
  cycleMode: () => void;
  toggleFloating: () => void;
  resetPosition: () => void;
  containerStyle: React.CSSProperties;
  style: React.CSSProperties;
  containerClassName: string;
}
