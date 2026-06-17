"use client";
// Stream raw — encoder pulses + IMU quaternion/gyro + timestamp
// Tipo "consola serial" para o treinador inspecionar sinal bruto em tempo real
import { motion } from "framer-motion";
import type { LiveFrame } from "@/lib/types";
import { LIVE_SOURCE } from "@/hooks/useAutoLiveSession";

const SOURCE_LABEL = LIVE_SOURCE === "local-ws" ? "RAW · Local WS" : "RAW · Realtime DB";

interface Props {
  frames: LiveFrame[];
}

export function RawStreamTicker({ frames }: Props) {
  if (frames.length === 0) {
    return (
      <div className="bg-sesi-black rounded-xl p-4 font-mono-num text-[11px] text-white/30 h-64 flex items-center justify-center">
        <span className="uppercase tracking-widest">Aguardando stream do ESP32…</span>
      </div>
    );
  }

  return (
    <div className="bg-sesi-black rounded-xl p-3 font-mono-num text-[10px] leading-relaxed h-64 overflow-y-auto">
      <div className="sticky top-0 bg-sesi-black pb-1.5 mb-1.5 border-b border-sesi-graphite flex items-center justify-between">
        <span className="text-sesi-red-300 font-bold uppercase tracking-widest">{SOURCE_LABEL}</span>
        <span className="text-white/40">{frames.length} frames</span>
      </div>
      <div className="space-y-0.5">
        {frames.map((f, i) => (
          <motion.div
            key={`${f.ts}-${i}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: i === 0 ? 1 : 0.7 - i * 0.025, x: 0 }}
            className="grid grid-cols-12 gap-2 text-white/80 hover:bg-white/[0.03] px-1 py-0.5 rounded"
          >
            <span className="col-span-2 text-white/40 tabular-nums">{f.elapsed.toFixed(2)}s</span>
            <span className="col-span-2 text-sesi-red-300 tabular-nums">p={f.encoderPulses}</span>
            <span className="col-span-2 text-amber-400 tabular-nums">{f.encoderRpm.toFixed(0)}rpm</span>
            <span className="col-span-3 text-cyan-400 tabular-nums">q[{f.imuQuat[0].toFixed(2)},{f.imuQuat[3].toFixed(2)}]</span>
            <span className="col-span-3 text-emerald-400 tabular-nums">g[{f.imuGyro[0].toFixed(0)},{f.imuGyro[1].toFixed(0)},{f.imuGyro[2].toFixed(0)}]</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
