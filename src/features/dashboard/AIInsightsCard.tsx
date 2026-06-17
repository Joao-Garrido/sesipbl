"use client";
// Renamed from "Insights de IA" → "Insights Sugeridos" (sem referência a IA)
import { motion } from "framer-motion";
import { HiOutlineLightBulb, HiOutlineExclamationTriangle, HiOutlineArrowTrendingUp, HiOutlineInformationCircle } from "react-icons/hi2";
import type { AIInsight } from "@/lib/mock";
import { cn } from "@/lib/utils";

interface Props {
  insights: AIInsight[];
}

const severityConfig = {
  positive: { icon: HiOutlineArrowTrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-700" },
  warning:  { icon: HiOutlineExclamationTriangle, color: "text-amber-600", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-700" },
  info:     { icon: HiOutlineInformationCircle, color: "text-sesi-red-600", bg: "bg-sesi-red-50", chip: "bg-sesi-red-100 text-sesi-red-700" },
};

export function AIInsightsCard({ insights }: Props) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-sesi-red-50 flex items-center justify-center">
          <HiOutlineLightBulb className="w-4 h-4 text-sesi-red-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-text">Insights Sugeridos</h3>
          <p className="text-xs text-text-muted">Padrões detectados nas últimas sessões</p>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {insights.map((it, i) => {
          const cfg = severityConfig[it.severity];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: 0.05 * i, ease: "easeOut" }}
              className="flex gap-3 p-3 rounded-lg hover:bg-track-50/40 transition-colors cursor-pointer"
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg)}>
                <Icon className={cn("w-4 h-4", cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold text-text truncate">{it.title}</h4>
                  {it.metric && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold tabular-nums", cfg.chip)}>{it.metric}</span>
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{it.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
