"use client";
import { HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown, HiOutlineMinus } from "react-icons/hi2";
import { cn } from "@/lib/utils";

interface DeltaIndicatorProps {
  value: number;
  label?: string;
  size?: "sm" | "md";
  unit?: string; // sufixo do número (default "%"); ex: " pts"
}

export function DeltaIndicator({ value, label, size = "md", unit = "%" }: DeltaIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const formatted = `${isPositive ? "+" : ""}${value.toFixed(1)}${unit}`;
  const Icon = isPositive ? HiOutlineArrowTrendingUp : isNegative ? HiOutlineArrowTrendingDown : HiOutlineMinus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold",
        size === "sm" ? "text-xs" : "text-sm",
        isPositive && "text-emerald-600",
        isNegative && "text-red-500",
        !isPositive && !isNegative && "text-text-muted"
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {formatted}
      {label && <span className="text-text-muted font-normal text-xs ml-0.5">{label}</span>}
    </span>
  );
}
