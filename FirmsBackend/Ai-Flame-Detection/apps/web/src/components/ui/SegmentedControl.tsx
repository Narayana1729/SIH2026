import React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex items-center bg-surface-raised border border-border rounded-control p-0.5 select-none",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center font-sans font-medium rounded-control transition-all duration-150 text-center active:scale-[0.98] cursor-pointer",
              size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-3 py-1 text-xs gap-1.5",
              isActive
                ? "bg-surface text-foreground font-semibold shadow-sm border border-border/80"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover/60 border border-transparent"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
