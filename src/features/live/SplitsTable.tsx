"use client";
// Splits por fase — populados conforme deslocamento avança. Os checkpoints
// acompanham a distância da prova (10/30/60/100m numa prova longa; trechos da
// prova curta), em vez de ficarem presos nos marcos de 100m.
import type { VelocityPoint } from "@/lib/types";
import { buildPhases, fmtMeters } from "@/lib/phases";

interface Props {
  curve: VelocityPoint[];
  displacement: number;
  target?: number; // distância-alvo da prova (default 100m)
}

export function SplitsTable({ curve, displacement, target = 100 }: Props) {
  const checkpoints = buildPhases(target).map((p) => p.hi); // fins de cada faixa
  const splits = checkpoints.map((cp) => {
    const point = curve.find((p) => (p.d ?? 0) >= cp);
    const reached = displacement >= cp;
    return {
      meters: cp,
      time: point?.t,
      vel: point?.v,
      reached,
    };
  });

  return (
    <div className="space-y-1.5">
      {splits.map((s) => (
        <div
          key={s.meters}
          className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
            s.reached ? "bg-sesi-red-50 border border-sesi-red-100" : "bg-track-50/40 border border-border"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${s.reached ? "bg-sesi-red-500" : "bg-border"}`} />
            <span className="text-sm font-bold tabular-nums">{fmtMeters(s.meters)}m</span>
          </div>
          <div className="flex items-center gap-3">
            {s.time !== undefined ? (
              <>
                <span className="text-sm font-mono-num font-semibold tabular-nums">{s.time.toFixed(2)}<span className="text-xs text-text-muted ml-0.5">s</span></span>
                <span className="text-xs text-text-muted tabular-nums">{s.vel?.toFixed(1)} m/s</span>
              </>
            ) : (
              <span className="text-xs text-text-muted">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
