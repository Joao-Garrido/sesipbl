"use client";
// SESI red palette — barras horizontais com direct labeling
import { motion } from "framer-motion";

interface Phase { name: string; range: string; value: number; color: string; }

interface Props { phases: Phase[]; }

function levelClass(v: number): string {
  if (v >= 90) return "text-emerald-600";
  if (v >= 80) return "text-cyan-600";
  if (v >= 70) return "text-amber-600";
  return "text-red-600";
}

export function PhaseRadial({ phases }: Props) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Velocidade por fase</span>
        <span className="text-[10px] text-text-muted">% da velocidade de pico</span>
      </div>
      <div className="space-y-3">
        {phases.map((p, i) => (
          <div key={p.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold text-text truncate">{p.name}</span>
                <span className="text-[10px] text-text-muted tabular-nums">{p.range}</span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${levelClass(p.value)}`}>{p.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-track-50 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${p.value}%` }}
                transition={{ duration: 0.3, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{ background: p.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
        Velocidade média em cada faixa de distância, como % da velocidade de pico do atleta.
      </p>
    </div>
  );
}
