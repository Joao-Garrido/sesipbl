"use client";
import { motion } from "framer-motion";
import { HiOutlineClock, HiOutlineCalendarDays } from "react-icons/hi2";
import type { UpcomingSession } from "@/lib/mock";

interface Props {
  data: UpcomingSession[];
}

export function UpcomingSessions({ data }: Props) {
  return (
    <div className="space-y-2">
      {data.map((u, i) => (
        <motion.div
          key={u.id}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: i * 0.04 }}
          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-track-500/30 hover:shadow-sm transition-all cursor-pointer bg-white"
        >
          <div className="w-10 h-10 rounded-lg bg-track-50 flex flex-col items-center justify-center flex-shrink-0">
            <HiOutlineCalendarDays className="w-3.5 h-3.5 text-track-600" />
            <span className="text-[9px] text-track-700 font-bold mt-0.5">{u.date}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{u.athleteName}</p>
            <p className="text-xs text-text-muted truncate">{u.foco}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <HiOutlineClock className="w-3 h-3" />
            <span className="tabular-nums font-semibold">{u.hora}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
