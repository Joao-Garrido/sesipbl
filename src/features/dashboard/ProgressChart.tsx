"use client";
// SESI red palette — high data-ink ratio, reference line = média histórica
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// Ponto genérico do gráfico — serve tanto para resumo por sessão quanto por tentativa.
export interface ProgressPoint {
  label: string;
  peakVelocity: number;
  bestT100m: number | null;
  consistency: number;
}

interface Props {
  data: ProgressPoint[];
  metric: "peakVelocity" | "bestT100m" | "consistency";
}

const config = {
  peakVelocity:    { label: "Velocidade pico", unit: "m/s",  color: "#B91C2C", invert: false },
  bestT100m:       { label: "Tempo",           unit: "s",    color: "#1A1A1A", invert: true },
  consistency:     { label: "Consistência",    unit: "%",    color: "#6B1019", invert: false },
};

export function ProgressChart({ data, metric }: Props) {
  const cfg = config[metric];
  const values = data.map((d) => d[metric]).filter((v): v is number => v != null);
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <p className="text-sm text-text-muted">Sem sessões registradas ainda.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={cfg.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
        <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}${cfg.unit}`} domain={cfg.invert ? ["dataMin - 0.2", "dataMax + 0.2"] : ["auto", "auto"]} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #1A1A1A", background: "#0A0A0A", color: "white", fontSize: 12, padding: "8px 12px" }} formatter={(v: number) => [`${v.toFixed(2)} ${cfg.unit}`, cfg.label]} />
        {values.length > 0 && <ReferenceLine y={avg} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: `méd ${avg.toFixed(1)}`, fill: cfg.color, fontSize: 10, position: "right" }} />}
        <Area type="monotone" dataKey={metric} stroke={cfg.color} strokeWidth={2.5} fill={`url(#grad-${metric})`} dot={{ r: 3, fill: cfg.color }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
