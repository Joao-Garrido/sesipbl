// Reuso 1:1 do Vinlet StatCard, simplificado para KPIs de tempo real
"use client";
import { type ReactNode } from "react";
import { Badge, perfLevel } from "./Badge";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  reference?: number; // valor de referência para banding semáforo
  icon?: ReactNode;
  large?: boolean; // KPI tamanho grande para tela ao vivo
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  reference,
  icon,
  large = false,
  className = "",
}: StatCardProps) {
  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  const hasRef = reference !== undefined && reference > 0;
  const pct = hasRef && !isNaN(numeric) ? (numeric / reference!) * 100 : 0;
  const level = perfLevel(pct);

  return (
    <div
      className={`bg-white rounded-xl border border-border shadow-sm flex flex-col gap-2 ${large ? "p-7" : "p-5"} ${className}`}
    >
      <div className="flex items-start justify-between">
        <span className={`font-medium text-text-muted ${large ? "text-base" : "text-sm"}`}>
          {label}
        </span>
        {icon && (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-track-600 bg-track-100">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-bold text-text tabular-nums ${large ? "text-5xl" : "text-2xl"}`}>
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-text-muted text-sm">{unit}</span>}
      </div>
      {hasRef && (
        <div className="flex items-center gap-2">
          <Badge variant={level} size="sm">
            {pct.toFixed(0)}% ref
          </Badge>
          <span className="text-xs text-text-muted">ref: {reference!.toFixed(1)}{unit}</span>
        </div>
      )}
    </div>
  );
}
