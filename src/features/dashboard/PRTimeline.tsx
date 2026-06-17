"use client";
import { motion } from "framer-motion";
import type { PRRecord } from "@/lib/mock";

interface Props { prs: PRRecord[]; }

const labels: Record<string, string> = {
  vel: "VEL",
  t100m: "100m",
  tempo: "TEMPO",
  t10m: "10m",
  ang: "ÂNG",
};

export function PRTimeline({ prs }: Props) {
  if (prs.length === 0) return <p className="text-sm text-text-muted text-center py-4">Sem PRs registados.</p>;
  return (
    <ol className="relative space-y-3 pl-5">
      <span className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-border" />
      {prs.map((pr, i) => (
        <motion.li
          key={pr.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, delay: i * 0.05 }}
          className="relative"
        >
          <span className="absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full bg-sesi-red-500 ring-4 ring-sesi-red-50" />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono-num font-bold bg-sesi-red-50 text-sesi-red-600 tracking-wider">{labels[pr.metric]}</span>
                <span className="text-sm font-semibold truncate">{pr.label}</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5 tabular-nums">{pr.date}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-base font-black text-sesi-red-500 tabular-nums">{pr.value}</div>
              {pr.delta && <div className="text-[10px] font-bold text-emerald-600 tabular-nums">{pr.delta}</div>}
            </div>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
