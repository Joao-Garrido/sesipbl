"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HiOutlineSun } from "react-icons/hi2";
import { Badge } from "@/shared/components/Badge";

interface Props {
  coachName?: string;
  todayLocal?: string;
  athletesCount: number;
  sessionsToday: number;
}

export function WelcomeHeader({ coachName = "Treinador", todayLocal, athletesCount, sessionsToday }: Props) {
  // Compute on mount only — avoid hydration mismatch from server/client clock skew
  const [greeting, setGreeting] = useState("Olá");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="bg-gradient-to-br from-sesi-black via-sesi-charcoal to-sesi-red-700 rounded-2xl p-6 text-white shadow-sm relative overflow-hidden"
    >
      {/* Decorative red glow */}
      <div className="absolute top-0 right-0 w-2/5 h-full bg-gradient-to-l from-sesi-red-500/30 to-transparent pointer-events-none" />
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-sesi-red-500/20 blur-3xl pointer-events-none" />
      <div className="relative flex items-center justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HiOutlineSun className="w-4 h-4 text-sesi-red-300" />
            <span className="text-xs uppercase tracking-wider text-white/70">{greeting}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{coachName}</h1>
          {todayLocal && <p className="text-sm text-white/70 mt-1">{todayLocal}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs text-white/60 uppercase tracking-wider">Atletas</span>
            <span className="text-2xl font-bold tabular-nums">{athletesCount}</span>
          </div>
          <div className="w-px h-10 bg-white/15" />
          <div className="flex flex-col items-end">
            <span className="text-xs text-white/60 uppercase tracking-wider">Sessões hoje</span>
            <span className="text-2xl font-bold tabular-nums">{sessionsToday}</span>
          </div>
          <div className="ml-3 flex flex-col items-end gap-1">
            <Badge variant="gold" size="sm">SESI Sprint</Badge>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
