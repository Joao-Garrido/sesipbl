"use client";
// Cronômetro digital grande — legível de longe pelo treinador
import { motion } from "framer-motion";

interface Props {
  elapsed: number; // segundos
  isLive: boolean;
}

export function Chronometer({ elapsed, isLive }: Props) {
  const totalMs = Math.max(0, elapsed * 1000);
  const min = Math.floor(totalMs / 60000);
  const sec = Math.floor((totalMs % 60000) / 1000);
  const cs = Math.floor((totalMs % 1000) / 10); // centésimos

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-sesi-black rounded-2xl p-5 text-white relative overflow-hidden border border-sesi-graphite"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sesi-red-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Cronômetro</span>
          {isLive && (
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-sesi-red-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-sesi-red-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sesi-red-500" />
              </span>
              REC
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 font-mono-num">
          <span className="text-5xl font-black tracking-tight tabular-nums">
            {String(min).padStart(2, "0")}
          </span>
          <span className="text-3xl text-white/40 font-bold">:</span>
          <span className="text-5xl font-black tracking-tight tabular-nums">
            {String(sec).padStart(2, "0")}
          </span>
          <span className="text-2xl text-sesi-red-300 font-bold ml-0.5 tabular-nums">
            .{String(cs).padStart(2, "0")}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
