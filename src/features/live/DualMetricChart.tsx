"use client";
// Velocidade + Deslocamento no mesmo gráfico — dual axis
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VelocityPoint } from "@/lib/types";
import { useChartZoom, ZoomControls } from "@/hooks/useChartZoom";

interface Props {
  data: VelocityPoint[];
  reference?: number;
  peakVelTime?: number;
}

export function DualMetricChart({ data, reference, peakVelTime }: Props) {
  // Janela de tempo estável (estilo osciloscópio): evita que a curva "encolha /
  // espreme para a direita" conforme o tempo passa. Mostra até 20s; depois
  // desliza mantendo a escala do eixo X fixa.
  const WINDOW_S = 15;
  const lastT = data.length ? data[data.length - 1].t : 0;
  // Janela deslizante que SEMPRE preenche a largura: [0,t] enquanto t<janela,
  // depois desliza [t-janela, t]. Sem espremer, sem espaço vazio.
  const xDomain: [number, number] = [Math.max(0, lastT - WINDOW_S), lastT > 0 ? lastT : 1];
  const zoom = useChartZoom(xDomain);

  return (
    <div className="relative">
      <ZoomControls isZoomed={zoom.isZoomed} onReset={zoom.reset} />
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: -8, bottom: 0 }} {...zoom.handlers}>
        <defs>
          <linearGradient id="velFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B91C2C" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#B91C2C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          stroke="#6B7280"
          fontSize={11}
          tickFormatter={(v) => `${Math.round(v)}s`}
          domain={zoom.domain}
          allowDataOverflow
          type="number"
          tickLine={false}
        />
        <YAxis yAxisId="vel" stroke="#B91C2C" fontSize={11} tickFormatter={(v) => `${v}m/s`} tickLine={false} axisLine={false} />
        <YAxis yAxisId="disp" orientation="right" stroke="#1A1A1A" fontSize={11} tickFormatter={(v) => `${v}m`} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, padding: "8px 12px", background: "#0A0A0A", color: "white" }}
          labelFormatter={(t) => `t = ${t}s`}
          formatter={(v: number, name) => [`${v.toFixed(2)}`, name === "v" ? "Velocidade (m/s)" : "Deslocamento (m)"]}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
        {reference && (
          <ReferenceLine yAxisId="vel" y={reference} stroke="#C5A059" strokeDasharray="4 4" label={{ value: "ref histórica", fill: "#C5A059", fontSize: 10, position: "right" }} />
        )}
        {peakVelTime !== undefined && (
          <ReferenceLine yAxisId="vel" x={peakVelTime} stroke="#B91C2C" strokeDasharray="2 2" label={{ value: "pico vel", fill: "#B91C2C", fontSize: 9, position: "top" }} />
        )}
        <Area yAxisId="vel" type="monotone" dataKey="v" name="Velocidade" stroke="#B91C2C" strokeWidth={2.5} fill="url(#velFill)" isAnimationActive={false} />
        <Line yAxisId="disp" type="monotone" dataKey="d" name="Deslocamento" stroke="#1A1A1A" strokeWidth={1.8} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
        {zoom.sel.l != null && zoom.sel.r != null && (
          <ReferenceArea yAxisId="vel" x1={zoom.sel.l} x2={zoom.sel.r} strokeOpacity={0.3} fill="#B91C2C" fillOpacity={0.12} />
        )}
      </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
