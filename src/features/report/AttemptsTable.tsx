"use client";
import type { Attempt } from "@/lib/types";
import { exitPeakVelocity } from "@/lib/analysis";
import { Badge, perfLevel } from "@/shared/components/Badge";
import { HiOutlineTableCells } from "react-icons/hi2";

interface Props {
  attempts: Attempt[];
  // Baixa o CSV bruto (literal da ESP) de UMA tentativa. Se ausente, a coluna não aparece.
  onDownloadRaw?: (a: Attempt) => void;
}

export function AttemptsTable({ attempts, onDownloadRaw }: Props) {
  const best = attempts.length ? Math.max(...attempts.map((a) => a.metrics.peakVelocity)) : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-text-muted border-b border-border">
            <th className="py-2 px-3">#</th>
            <th className="py-2 px-3">Prova</th>
            <th className="py-2 px-3">Distância</th>
            <th className="py-2 px-3">Vel. Pico</th>
            <th className="py-2 px-3">Vel. Saída</th>
            <th className="py-2 px-3">Ângulo</th>
            <th className="py-2 px-3">t10m</th>
            <th className="py-2 px-3">Tempo</th>
            <th className="py-2 px-3">Consist.</th>
            <th className="py-2 px-3">Status</th>
            {onDownloadRaw && <th className="py-2 px-3">Bruto</th>}
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => {
            const pct = best > 0 ? (a.metrics.peakVelocity / best) * 100 : 0;
            const tFinal = a.metrics.tFinal ?? a.metrics.t100m; // compat dados antigos
            // distância REAL percorrida (máx. da curva) — ex.: 2,45m numa parcial
            const reached = a.velocityCurve.length ? Math.max(...a.velocityCurve.map((p) => p.d ?? 0)) : 0;
            // pico da saída (1ºs 10%): métrica salva; cai pra curva em dados antigos.
            const exitPeak = a.metrics.exitPeakVelocity ?? exitPeakVelocity(a.velocityCurve, a.distance ?? 100);
            return (
              <tr key={a.id} className="border-b border-border/60 hover:bg-track-50/30">
                <td className="py-2.5 px-3 font-semibold">{a.numero}</td>
                <td className="py-2.5 px-3 tabular-nums text-text-muted">{a.distance ?? 100}m</td>
                <td className="py-2.5 px-3 tabular-nums font-semibold">{reached.toFixed(2)}m</td>
                <td className="py-2.5 px-3 tabular-nums">{a.metrics.peakVelocity.toFixed(1)} <span className="text-text-muted">m/s</span></td>
                <td className="py-2.5 px-3 tabular-nums">{exitPeak > 0 ? <>{exitPeak.toFixed(1)} <span className="text-text-muted">m/s</span></> : "—"}</td>
                <td className="py-2.5 px-3 tabular-nums">{a.metrics.startAngle}°</td>
                <td className="py-2.5 px-3 tabular-nums">{a.metrics.t10m != null ? `${a.metrics.t10m.toFixed(2)}s` : "—"}</td>
                <td className="py-2.5 px-3 tabular-nums">{tFinal != null ? `${tFinal.toFixed(2)}s` : "—"}</td>
                <td className="py-2.5 px-3">
                  <Badge variant={perfLevel(pct)} size="sm">
                    {pct.toFixed(0)}%
                  </Badge>
                </td>
                <td className="py-2.5 px-3">
                  <Badge variant={a.status === "completa" ? "optimal" : a.status === "ao-vivo" ? "live" : a.status === "parcial" ? "warning" : "critical"} size="sm" dot={a.status === "ao-vivo"}>
                    {a.status}
                  </Badge>
                </td>
                {onDownloadRaw && (
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => onDownloadRaw(a)}
                      disabled={!a.rawSamples?.length}
                      title={a.rawSamples?.length ? "Baixar dados brutos da ESP desta tentativa (CSV)" : "Esta tentativa não tem dados brutos"}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border border-border hover:bg-track-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <HiOutlineTableCells className="w-3.5 h-3.5" /> Bruto
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
