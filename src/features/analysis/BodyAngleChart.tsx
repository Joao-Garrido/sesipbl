"use client";
// Curva do ÂNGULO DO CORPO durante a corrida (modelo de inclinação por aceleração —
// ver lib/analysis.ts:bodyAngleCurve). Convenção: 90° = corpo ereto. Começa acima de
// 90° na saída (tronco inclinado, aceleração alta) e converge para 90° quando a
// corrida estabiliza. Linha de referência em 90° = "corpo ereto".
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BodyAnglePoint } from "@/lib/analysis";

interface Props {
  points: BodyAnglePoint[];
  height?: number;
}

export function BodyAngleChart({ points, height = 240 }: Props) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-text-muted" style={{ height }}>
        Sem dados suficientes para o ângulo do corpo.
      </div>
    );
  }

  // Domínio Y simétrico em torno de 90°, com folga, para o "corpo ereto" ficar no meio.
  const angles = points.map((p) => p.angle);
  const spread = Math.max(10, Math.ceil(Math.max(...angles.map((a) => Math.abs(a - 90))) + 5));
  const yDomain: [number, number] = [90 - spread, 90 + spread];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          stroke="#6B7280"
          fontSize={11}
          tickFormatter={(v) => `${(+v).toFixed(1)}s`}
          tickLine={false}
        />
        <YAxis
          stroke="#6B7280"
          fontSize={11}
          domain={yDomain}
          tickFormatter={(v) => `${Math.round(v)}°`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, padding: "8px 12px", background: "#0A0A0A", color: "white" }}
          labelFormatter={(t) => `t = ${(+t).toFixed(2)} s`}
          formatter={(v: number) => [`${v.toFixed(1)}°`, "Ângulo do corpo"]}
        />
        <ReferenceLine y={90} stroke="#2D4F4F" strokeDasharray="5 4" label={{ value: "corpo ereto (90°)", fill: "#2D4F4F", fontSize: 10, position: "insideBottomRight" }} />
        <Line type="monotone" dataKey="angle" stroke="#B91C2C" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
