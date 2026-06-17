"use client";
// Adaptado do Vinlet — tones SESI red shades + utility tones
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DeltaIndicator } from "./DeltaIndicator";
import { Sparkline } from "./Sparkline";

type KPITone =
  | "red-vivid"   // crimson principal — Velocidade
  | "red-deep"    // vermelho escuro — Aceleração
  | "wine"        // vinho — Ângulo
  | "rose"        // rosa salmão — Consistência
  | "default" | "track" | "gold" | "positive" | "warning" | "danger";

const toneConfig: Record<KPITone, { accent: string; iconBg: string; iconText: string; sparkColor: string }> = {
  "red-vivid": { accent: "bg-[#B91C2C]", iconBg: "bg-[#B91C2C]/10", iconText: "text-[#B91C2C]", sparkColor: "#B91C2C" },
  "red-deep":  { accent: "bg-[#8C1521]", iconBg: "bg-[#8C1521]/10", iconText: "text-[#8C1521]", sparkColor: "#8C1521" },
  "wine":      { accent: "bg-[#6B1019]", iconBg: "bg-[#6B1019]/10", iconText: "text-[#6B1019]", sparkColor: "#6B1019" },
  "rose":      { accent: "bg-[#D04F5C]", iconBg: "bg-[#D04F5C]/10", iconText: "text-[#D04F5C]", sparkColor: "#D04F5C" },
  default:  { accent: "bg-track-600", iconBg: "bg-track-50", iconText: "text-track-600", sparkColor: "#B91C2C" },
  track:    { accent: "bg-track-700", iconBg: "bg-track-100", iconText: "text-track-700", sparkColor: "#0A0A0A" },
  gold:     { accent: "bg-gold-400", iconBg: "bg-gold-400/10", iconText: "text-gold-500", sparkColor: "#C5A059" },
  positive: { accent: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-600", sparkColor: "#10B981" },
  warning:  { accent: "bg-amber-500", iconBg: "bg-amber-50", iconText: "text-amber-600", sparkColor: "#F59E0B" },
  danger:   { accent: "bg-red-500", iconBg: "bg-red-50", iconText: "text-red-500", sparkColor: "#EF4444" },
};

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  deltaUnit?: string;
  icon?: ReactNode;
  sparklineData?: number[];
  onClick?: () => void;
  className?: string;
  tone?: KPITone;
}

export function KPICard({
  title, value, unit, delta, deltaLabel, deltaUnit, icon, sparklineData, onClick,
  className = "", tone = "default",
}: KPICardProps) {
  const t = toneConfig[tone];
  return (
    <motion.div
      className={cn(
        "relative overflow-hidden bg-white rounded-xl ring-1 ring-black/[0.04] shadow-sm p-5 flex flex-col gap-3",
        onClick && "cursor-pointer",
        className,
      )}
      whileHover={{ y: -2, boxShadow: "0 6px 18px rgba(0,0,0,0.07)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={onClick}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", t.accent)} />
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0", t.iconBg, t.iconText)}>
            {icon}
          </div>
        )}
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted leading-tight">{title}</span>
      </div>
      <div className="flex items-end justify-between gap-3 pl-0.5">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-text tracking-tight tabular-nums">{value}</span>
          {unit && <span className="text-sm text-text-muted">{unit}</span>}
        </div>
        {sparklineData && sparklineData.length >= 2 && <Sparkline data={sparklineData} color={t.sparkColor} filled />}
      </div>
      {delta !== undefined && (
        <div className="pl-0.5">
          <DeltaIndicator value={delta} label={deltaLabel} unit={deltaUnit} size="sm" />
        </div>
      )}
    </motion.div>
  );
}
