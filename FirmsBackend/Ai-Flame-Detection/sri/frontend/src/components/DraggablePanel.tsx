import React, { useState, useRef, useCallback } from 'react';

interface DraggablePanelProps {
  id?: string;
  defaultPosition?: { x: number; y: number };
  children: React.ReactNode;
  className?: string;
  zIndex?: number;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  children,
  defaultPosition = { x: 0, y: 0 },
  className = '',
  zIndex = 400,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(defaultPosition);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: defaultPosition.x,
    initY: defaultPosition.y,
  });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only left-clicks
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    // Do not initiate drag if interacting with controls
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'A' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('a') ||
      target.closest('.no-drag')
    ) {
      return;
    }

    // Only allow drag on elements with .drag-handle OR the panel itself if designated
    const hasDragHandle = target.closest('.drag-handle');
    if (!hasDragHandle) {
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    setPosition({
      x: dragStartRef.current.initX + dx,
      y: dragStartRef.current.initY + dy,
    });
    e.stopPropagation();
  }, [isDragging]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      e.stopPropagation();
    }
  }, [isDragging]);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        zIndex,
        touchAction: 'none',
      }}
      className={`absolute transition-shadow duration-150 ${
        isDragging ? 'shadow-2xl shadow-black/60 ring-1 ring-zinc-700/50 select-none' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
