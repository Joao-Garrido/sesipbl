"use client";
// Volume de Treino — número de tentativas por sessão (mais intuitivo que TRIMP)
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell } from "recharts";
import type { SessionSummary } from "@/lib/mock";

interface Props { data: SessionSummary[]; }

function colorForVolume(n: number): string {
  if (n <= 2) return "#D04F5C"; // pouco
  if (n <= 4) return "#B91C2C"; // ideal
  return "#6B1019"; // muito
}

export function TrainingLoadChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.attemptsCount, 0);
  const avg = total / Math.max(1, data.length);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Tentativas por sessão</span>
        <span className="text-xs text-text-muted">
          Média <span className="font-bold text-text tabular-nums">{avg.toFixed(1)}</span> · Total <span className="font-bold text-text tabular-nums">{total}</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={[0, 6]} ticks={[0, 2, 4, 6]} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #1A1A1A", background: "#0A0A0A", color: "white", fontSize: 12 }}
            formatter={(v: number) => [`${v} tentativas`, "Volume"]}
          />
          <ReferenceLine y={3} stroke="#B91C2C" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "alvo", fill: "#B91C2C", fontSize: 9, position: "right" }} />
          <Bar dataKey="attemptsCount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.id} fill={colorForVolume(d.attemptsCount)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
        Cada barra = nº de corridas completas executadas naquela sessão. <span className="text-text">Alvo: 3–4 tentativas</span> por sessão (volume vs qualidade).
      </p>
    </div>
  );
}
