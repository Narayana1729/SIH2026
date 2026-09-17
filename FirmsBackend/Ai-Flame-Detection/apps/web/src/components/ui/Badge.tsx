import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "primary" | "success" | "warning" | "error" | "info" | "thermal" | "industrial" | "review";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center font-sans font-medium rounded-control select-none border";

  const variantStyles = {
    neutral: "bg-surface-raised border-border text-foreground-secondary",
    primary: "bg-accent/10 border-accent/20 text-accent",
    success: "bg-state-success/10 border-state-success/20 text-state-success",
    warning: "bg-state-warning/10 border-state-warning/20 text-state-warning",
    error: "bg-state-error/10 border-state-error/20 text-state-error",
    info: "bg-state-info/10 border-state-info/20 text-state-info",
    thermal: "bg-thermal/10 border-thermal/20 text-thermal",
    industrial: "bg-accent/10 border-accent/20 text-accent",
    review: "bg-state-warning/10 border-state-warning/20 text-state-warning",
  };

  const sizeStyles = {
    sm: "text-[11px] px-1.5 py-0.2 gap-1 rounded-[4px]",
    md: "text-xs px-2 py-0.5 gap-1.5 rounded-control",
  };

  const dotColors = {
    neutral: "bg-foreground-muted",
    primary: "bg-accent",
    success: "bg-state-success",
    warning: "bg-state-warning",
    error: "bg-state-error",
    info: "bg-state-info",
    thermal: "bg-thermal",
    industrial: "bg-accent",
    review: "bg-state-warning",
  };

  return (
    <span className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)} {...props}>
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])} />}
      {children}
    </span>
  );
}
