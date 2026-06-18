"use client";
// Perfil de velocidade média por trecho — 4 divisões IGUAIS da distância da prova
// (lib/phases). Cada barra é rotulada só pelo METRO FINAL do quarto (ex.: prova de 20m
// → 5, 10, 15, 20 m) e mostra a velocidade média até ali. Adapta-se à distância.
import type { Attempt } from "@/lib/types";
import { buildPhases, fmtMeters } from "@/lib/phases";

interface Props {
  attempt: Attempt;
}

function phaseColor(vel: number): string {
  if (vel >= 8) return "bg-emerald-500";
  if (vel >= 6) return "bg-cyan-500";
  if (vel >= 3) return "bg-amber-500";
  return "bg-red-500";
}

export function PhaseProfile({ attempt }: Props) {
  // Velocidade média em cada um dos 4 quartos (faixas iguais de deslocamento).
  const velByPhase = buildPhases(attempt.distance ?? 100).map((p) => {
    const pts = attempt.velocityCurve.filter((pt) => (pt.d ?? 0) >= p.lo && (pt.d ?? 0) < p.hi);
    const vel = pts.length ? pts.reduce((sum, pt) => sum + pt.v, 0) / pts.length : 0;
    return { hi: p.hi, vel };
  });

  const max = Math.max(...velByPhase.map((p) => p.vel), 10);

  return (
    <div className="space-y-3">
      {velByPhase.map((p, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted tabular-nums">{fmtMeters(p.hi)}m</span>
            <span className="font-semibold tabular-nums">{p.vel.toFixed(1)} m/s</span>
          </div>
          <div className="h-2 rounded-full bg-track-50 overflow-hidden">
            <div
              className={`h-full rounded-full ${phaseColor(p.vel)} transition-all`}
              style={{ width: `${Math.max(2, (p.vel / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
