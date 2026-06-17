"use client";
// Perfil de velocidade média por fase — derivado da velocidade + deslocamento.
// As faixas acompanham a distância da prova (lib/phases): longas nomeadas, curtas só faixa.
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
  // Velocidade média por fase a partir da curva (faixas de deslocamento da prova)
  const phases = buildPhases(attempt.distance ?? 100).map((p) => {
    const faixa = `${fmtMeters(p.lo)}–${fmtMeters(p.hi)}m`;
    return { label: p.label ? `${p.label} (${faixa})` : faixa, range: [p.lo, p.hi] as [number, number] };
  });

  const velByPhase = phases.map((p) => {
    const pts = attempt.velocityCurve.filter((pt) => (pt.d ?? 0) >= p.range[0] && (pt.d ?? 0) < p.range[1]);
    if (pts.length === 0) return { ...p, vel: 0 };
    const vel = pts.reduce((sum, pt) => sum + pt.v, 0) / pts.length;
    return { ...p, vel };
  });

  const max = Math.max(...velByPhase.map((p) => p.vel), 10);

  return (
    <div className="space-y-3">
      {velByPhase.map((p) => (
        <div key={p.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">{p.label}</span>
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
