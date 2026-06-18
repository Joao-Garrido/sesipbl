"use client";
// Velocidade instantânea na SAÍDA DO BLOCO (primeiros 10% da prova) × deslocamento.
// Mostra TODOS os pontos da fase de saída e marca o pico de velocidade.
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VelocityPoint } from "@/lib/types";

interface Props {
  points: VelocityPoint[]; // pontos da janela de saída
  windowM?: number; // limite da janela (m) — fixa o eixo X
  height?: number;
  showPeak?: boolean; // marca o pico de velocidade (default true)
}

export function ExitVelocityChart({ points, windowM, height = 240, showPeak = true }: Props) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-text-muted" style={{ height }}>
        Sem dados suficientes na saída ainda.
      </div>
    );
  }

  const peak = points.reduce((m, p) => (p.v > m.v ? p : m), points[0]);
  const maxD = windowM ?? points[points.length - 1].d ?? 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="exitVelFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B91C2C" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#B91C2C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="d"
          type="number"
          domain={[0, +maxD.toFixed(2)]}
          stroke="#6B7280"
          fontSize={11}
          tickFormatter={(v) => (Number.isInteger(v) ? `${v}m` : `${v.toFixed(1)}m`)}
          tickLine={false}
        />
        <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${v}m/s`} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, padding: "8px 12px", background: "#0A0A0A", color: "white" }}
          labelFormatter={(d) => `${(+d).toFixed(2)} m`}
          formatter={(v: number) => [`${v.toFixed(2)} m/s`, "Velocidade"]}
        />
        <Area type="natural" dataKey="v" stroke="#B91C2C" strokeWidth={2.5} fill="url(#exitVelFill)" isAnimationActive={false} />
        {showPeak && (
          <ReferenceDot x={peak.d} y={peak.v} r={4} fill="#B91C2C" stroke="#fff" strokeWidth={1.5} isFront
            label={{ value: `pico ${peak.v.toFixed(2)} m/s`, fontSize: 10, fill: "#B91C2C", position: "top" }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
