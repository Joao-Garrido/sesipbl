"use client";
// Athlete pills selector — visual chip com layoutId active animation
import { motion } from "framer-motion";
import type { Athlete } from "@/lib/types";

interface Props {
  athletes: Athlete[];
  selected: string;
  onSelect: (id: string) => void;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function AthleteSwitcher({ athletes, selected, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {athletes.map((a) => {
        const active = a.id === selected;
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className="relative px-3 py-1.5 rounded-full text-sm transition-colors"
          >
            {active && (
              <motion.span
                layoutId="athlete-switch-bg"
                className="absolute inset-0 rounded-full bg-sesi-black shadow-md"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className={`relative flex items-center gap-2 ${active ? "text-white" : "text-text hover:text-sesi-red-500"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black tracking-tight ${active ? "bg-sesi-red-500 text-white" : "bg-track-100 text-text"}`}>
                {initials(a.nome)}
              </span>
              <span className="font-semibold">{a.nome.split(" ")[0]}</span>
              <span className={`text-[10px] font-mono-num ${active ? "text-white/70" : "text-text-muted"}`}>{a.categoria}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
