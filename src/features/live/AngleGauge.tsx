"use client";
// Gauge semicircular SVG — 0° a 90°, zona verde ±5° da referência (REQ-04)
interface AngleGaugeProps {
  value: number; // ângulo atual (°)
  reference: number; // ângulo padrão de referência
  size?: number;
}

export function AngleGauge({ value, reference, size = 200 }: AngleGaugeProps) {
  const radius = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;

  // Mapeia 0°-90° para arco semicircular (180° → 0°)
  const angleToRad = (deg: number) => Math.PI - (deg / 90) * Math.PI;

  const polarPoint = (deg: number, r: number) => {
    const rad = angleToRad(deg);
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  };

  const arc = (start: number, end: number, r: number = radius) => {
    const [x1, y1] = polarPoint(start, r);
    const [x2, y2] = polarPoint(end, r);
    const large = Math.abs(end - start) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const greenStart = Math.max(0, reference - 5);
  const greenEnd = Math.min(90, reference + 5);

  const delta = Math.abs(value - reference);
  const color = delta <= 5 ? "#10B981" : delta <= 10 ? "#F59E0B" : "#EF4444";

  const [needleX, needleY] = polarPoint(value, radius - 8);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Track base */}
        <path d={arc(0, 90)} fill="none" stroke="#E5E7EB" strokeWidth={12} strokeLinecap="round" />
        {/* Zona verde de referência */}
        <path d={arc(greenStart, greenEnd)} fill="none" stroke="#10B98155" strokeWidth={12} strokeLinecap="round" />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill={color} />
        {/* Tick labels */}
        <text x={polarPoint(0, radius + 8)[0]} y={polarPoint(0, radius + 8)[1] + 4} fontSize="10" fill="#6B7280" textAnchor="end">0°</text>
        <text x={cx} y={20} fontSize="10" fill="#6B7280" textAnchor="middle">45°</text>
        <text x={polarPoint(90, radius + 8)[0]} y={polarPoint(90, radius + 8)[1] + 4} fontSize="10" fill="#6B7280" textAnchor="start">90°</text>
      </svg>
      <div className="text-center">
        <div className="text-3xl font-bold tabular-nums" style={{ color }}>
          {value.toFixed(1)}°
        </div>
        <div className="text-xs text-text-muted">ref: {reference.toFixed(0)}° (±5°)</div>
      </div>
    </div>
  );
}
