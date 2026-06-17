"use client";
// Card do atleta — só dados MEDIDOS/derivados: recordes, referências, nº de sessões.
import { motion } from "framer-motion";
import type { Athlete } from "@/lib/types";
import type { AthleteBio } from "@/lib/mock";

interface Props {
  athlete: Athlete;
  bio: AthleteBio;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function AthleteBioCard({ athlete, bio }: Props) {
  return (
    <motion.div
      key={athlete.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-xl border border-border shadow-sm overflow-hidden"
    >
      {/* Top: avatar + name + categoria */}
      <div className="px-5 py-4 bg-gradient-to-r from-sesi-black to-sesi-charcoal text-white relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-sesi-red-500/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sesi-red-500 text-white flex items-center justify-center font-black text-base shadow-lg shadow-sesi-red-500/30 ring-1 ring-white/10">
            {initials(athlete.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold tracking-tight truncate">{athlete.nome}</h3>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="font-mono-num">#{athlete.numeroAtleta}</span>
              <span>·</span>
              <span className="px-1.5 py-0.5 rounded bg-sesi-red-500/30 font-bold tracking-wider">{athlete.categoria}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Recordes (medidos) */}
        <div className="grid grid-cols-3 gap-2">
          <PRStat label="PR Vel" value={`${bio.prVelocidade.toFixed(1)}`} unit="m/s" />
          <PRStat label={`PR ${bio.prDistance}m`} value={bio.prTime != null ? bio.prTime.toFixed(2) : "—"} unit={bio.prTime != null ? "s" : ""} />
          <PRStat label="PR Ângulo" value={`${bio.prSaida}°`} unit="" />
        </div>

        {/* Referências do atleta + total de sessões */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
          <BioItem label="Ref. ângulo" value={`${athlete.referenciaAngulo}°`} />
          <BioItem
            label="Ref. vel"
            value={athlete.referenciaVelocidade ? `${athlete.referenciaVelocidade.toFixed(1)} m/s` : "—"}
          />
          <BioItem label="Sessões" value={`${bio.totalSessoes}`} />
        </div>
      </div>
    </motion.div>
  );
}

function PRStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-track-50/50 rounded-lg px-2 py-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-text-muted font-bold">{label}</div>
      <div className="text-base font-black tabular-nums text-sesi-red-500">
        {value}<span className="text-[10px] text-text-muted font-normal ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function BioItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{label}</div>
      <div className="font-bold tabular-nums text-sm">{value}</div>
    </div>
  );
}
