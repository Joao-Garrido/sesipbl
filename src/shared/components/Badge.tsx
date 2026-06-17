// Reuso 1:1 do Vinlet — variantes adaptadas para performance atlética
import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "primary" | "optimal" | "good" | "warning" | "critical" | "gold" | "live";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<string, string> = {
  primary: "bg-track-100 text-track-700",
  optimal: "bg-emerald-50 text-emerald-700",
  good: "bg-cyan-50 text-cyan-700",
  warning: "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700",
  gold: "bg-gold-400/10 text-gold-600 border border-gold-400/30",
  live: "bg-red-50 text-red-600",
};

const dotColors: Record<string, string> = {
  primary: "bg-track-600",
  optimal: "bg-emerald-500",
  good: "bg-cyan-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  gold: "bg-gold-500",
  live: "bg-red-500",
};

const sizeClasses: Record<string, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
};

export function Badge({
  children,
  variant = "primary",
  size = "md",
  dot = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full uppercase tracking-wide ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping ${dotColors[variant]}`}
          />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
        </span>
      )}
      {children}
    </span>
  );
}

/** Helper: classifica nível de performance baseado em % vs referência */
export function perfLevel(pctOfRef: number): BadgeProps["variant"] {
  if (pctOfRef >= 95) return "optimal";
  if (pctOfRef >= 90) return "good";
  if (pctOfRef >= 80) return "warning";
  return "critical";
}
