"use client";
// Indicador de fase atual baseado em deslocamento. As fases dependem da distância
// da prova (ver lib/phases): longas (>=60m) nomeadas, curtas (<60m) só com a faixa.
import { buildPhases } from "@/lib/phases";

interface Props {
  displacement: number;
  target?: number; // distância-alvo da prova (default 100m)
}

export function PhaseIndicator({ displacement, target = 100 }: Props) {
  const pct = Math.max(0, Math.min(100, (displacement / target) * 100));
  const phases = buildPhases(target);
  return (
    <div className="space-y-2">
      <div className="relative h-9 rounded-lg overflow-hidden border border-border bg-white">
        {phases.map((p) => {
          const active = displacement >= p.lo && displacement < p.hi;
          return (
            <div
              key={`${p.lo}-${p.hi}`}
              className={`absolute top-0 bottom-0 transition-all ${active ? "shadow-inner" : ""}`}
              style={{
                left: `${(p.lo / target) * 100}%`,
                width: `${((p.hi - p.lo) / target) * 100}%`,
                background: p.color,
                opacity: active ? 1 : 0.3,
              }}
            />
          );
        })}
        {/* Position pin */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all"
          style={{ left: `${Math.min(99, pct)}%` }}
        >
          <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-md" />
        </div>
      </div>
    </div>
  );
}
