"use client";
import { motion } from "framer-motion";
import type { Attempt } from "@/lib/types";
import { Sparkline } from "@/shared/components/dashboard/Sparkline";
import { Badge, perfLevel } from "@/shared/components/Badge";

interface Props {
  attempts: Attempt[];
}

export function RecentAttempts({ attempts }: Props) {
  const best = attempts.length ? Math.max(...attempts.map((a) => a.metrics.peakVelocity)) : 0;
  return (
    <div className="space-y-2">
      {attempts.slice().reverse().map((a, i) => {
        const pct = best > 0 ? (a.metrics.peakVelocity / best) * 100 : 0;
        const sparkData = a.velocityCurve.filter((_, idx) => idx % 6 === 0).map((p) => p.v);
        const tFin = a.metrics.tFinal ?? a.metrics.t100m;
        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-track-50/50 cursor-pointer transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-track-100 text-track-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              T{a.numero}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold tabular-nums">{a.metrics.peakVelocity.toFixed(1)} m/s</span>
                <Badge variant={perfLevel(pct)} size="sm">{pct.toFixed(0)}%</Badge>
              </div>
              <div className="text-xs text-text-muted">
                {a.distance ?? 100}m · Âng {a.metrics.startAngle}°{a.metrics.t10m != null ? ` · t10 ${a.metrics.t10m.toFixed(2)}s` : ""}{tFin != null ? ` · tempo ${tFin.toFixed(2)}s` : ""}
              </div>
            </div>
            <Sparkline data={sparkData} color="#2D4F4F" width={72} height={32} />
          </motion.div>
        );
      })}
    </div>
  );
}
