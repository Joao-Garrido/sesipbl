"use client";
import { useId } from "react";

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  filled?: boolean;
}

export function Sparkline({
  data,
  color = "#2D4F4F",
  width = 64,
  height = 28,
  filled = true,
}: SparklineProps) {
  const reactId = useId();
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = 2;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const coords = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * innerWidth,
    y: padding + innerHeight - ((val - min) / range) * innerHeight,
  }));

  const points = coords.map((c) => `${c.x},${c.y}`).join(" ");

  const areaPath = filled
    ? `M${coords[0].x},${coords[0].y} ${coords
        .slice(1)
        .map((c) => `L${c.x},${c.y}`)
        .join(" ")} L${coords[coords.length - 1].x},${height - padding} L${coords[0].x},${height - padding} Z`
    : "";

  const gradientId = `sparkline-grad-${reactId.replace(/:/g, "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true" className="flex-shrink-0">
      {filled && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {filled && areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <polyline points={points} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={2} fill={color} />
    </svg>
  );
}
