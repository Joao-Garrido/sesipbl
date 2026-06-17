"use client";
import { motion } from "framer-motion";
import { HiOutlineTrophy } from "react-icons/hi2";
import type { AthleteRanking } from "@/lib/mock";
import { DeltaIndicator } from "@/shared/components/dashboard/DeltaIndicator";

interface Props {
  data: AthleteRanking[];
}

export function AthleteLeaderboard({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.bestVel - a.bestVel);
  if (sorted.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-6">
        Sem dados suficientes para o ranking. Registre tentativas em Análise ao Vivo.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {sorted.map((a, i) => (
        <motion.div
          key={a.athleteId}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.04 }}
          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-track-50/50 transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
               style={{
                 background: i === 0 ? "linear-gradient(135deg,#C5A059,#B08A3E)" : i === 1 ? "#DCE8E8" : "#F5F5F3",
                 color: i === 0 ? "white" : "#2D4F4F",
               }}>
            {i === 0 ? <HiOutlineTrophy className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">{a.nome}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-track-100 text-track-700 font-semibold">{a.categoria}</span>
            </div>
            <div className="text-xs text-text-muted">Última sessão: {a.lastSession}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums">{a.bestVel.toFixed(1)} <span className="text-xs text-text-muted font-normal">m/s</span></div>
            <DeltaIndicator value={a.trend} size="sm" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
