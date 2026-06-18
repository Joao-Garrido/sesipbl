"use client";
// Overlay de tentativas de UMA prova (mesma distância). Velocidade × DESLOCAMENTO,
// eixo X = distância da prova (sem espaço vazio). A tentativa COMPLETA mais recente
// fica destacada (teal); as PARCIAIS (não chegaram ao fim) aparecem como linha
// VERMELHA sólida, nunca como "campeã". Com zoom por arraste.
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Attempt } from "@/lib/types";
import { smoothCurveVelocity } from "@/lib/analysis";
import { useChartZoom, ZoomControls } from "@/hooks/useChartZoom";

interface ComparisonChartProps {
  attempts: Attempt[];
  distance: number; // prova (m) — define o eixo X
}

export function ComparisonChart({ attempts, distance }: ComparisonChartProps) {
  const maxD = Math.max(1, distance);
  // Resolução fina (~480 pontos) pra a curva ficar fluida. O passo se adapta à distância.
  const POINTS = 480;
  const STEP = Math.max(0.02, maxD / POINTS);

  // Suaviza a velocidade de cada tentativa (média móvel, mesma ideia do Vel_media_movel
  // do ajuste_plot_vel.py): a Vel_ms do firmware atualiza a cada ~100 ms → o sinal cru é
  // uma escada que "pula"; a média móvel vira linha contínua. SÓ o traçado — dados salvos,
  // CSV bruto e métricas ficam intactos.
  const series = attempts.map((a) => ({ key: `T${a.numero}`, curve: smoothCurveVelocity(a.velocityCurve) }));

  const data: Record<string, number>[] = [];
  const nBins = Math.ceil(maxD / STEP);
  for (let i = 0; i <= nBins; i++) {
    const d = +Math.min(maxD, i * STEP).toFixed(3);
    const row: Record<string, number> = { d };
    series.forEach(({ key, curve }) => {
      const pt = curve.find((p) => (p.d ?? 0) >= d);
      if (pt) row[key] = pt.v;
    });
    data.push(row);
  }

  // Destaque = tentativa COMPLETA mais recente (nunca uma parcial).
  const completas = attempts.filter((a) => a.status === "completa");
  const latestCompletaId = completas.length
    ? completas.reduce((m, a) => (a.startedAt > m.startedAt ? a : m)).id
    : null;

  const zoom = useChartZoom([0, maxD]);

  return (
    <div className="relative">
      <ZoomControls isZoomed={zoom.isZoomed} onReset={zoom.reset} />
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }} {...zoom.handlers}>
          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="d" stroke="#6B7280" fontSize={11} tickFormatter={(v) => (Number.isInteger(v) ? `${v}m` : `${v.toFixed(1)}m`)} type="number" domain={zoom.domain} allowDataOverflow />
          <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${v}m/s`} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
            formatter={(v: number) => `${v.toFixed(2)} m/s`}
            labelFormatter={(d) => `${(+d).toFixed(2)} m`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {attempts.map((a) => {
            const isLatest = a.id === latestCompletaId;
            const isParcial = a.status !== "completa";
            return (
              <Line
                key={a.id}
                type="natural"
                dataKey={`T${a.numero}`}
                name={`T${a.numero}${isParcial ? " (parcial)" : ""}`}
                // parcial = linha VERMELHA sólida (mais fácil de ver que o tracejado antigo);
                // completa mais recente = teal destacado; demais completas = cinza.
                stroke={isLatest ? "#2D4F4F" : isParcial ? "#DC2626" : "#9CA3AF"}
                strokeWidth={isLatest ? 2.5 : isParcial ? 2 : 1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            );
          })}
          {zoom.sel.l != null && zoom.sel.r != null && (
            <ReferenceArea x1={zoom.sel.l} x2={zoom.sel.r} strokeOpacity={0.3} fill="#B91C2C" fillOpacity={0.12} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
