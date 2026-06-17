"use client";
// Modal de cadastro/edição de atleta — persiste local via useAthletes.
import { useState, type FormEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlineXMark } from "react-icons/hi2";
import type { Athlete } from "@/lib/types";

export interface AthleteFormData {
  nome: string;
  categoria: string;
  numeroAtleta?: string;
  referenciaAngulo: number;
  referenciaVelocidade?: number;
}

interface Props {
  /** Atleta a editar; ausente = criar novo. */
  athlete?: Athlete;
  onClose: () => void;
  onSubmit: (data: AthleteFormData) => void;
}

const CATEGORIAS = ["T11", "T12", "T13", "T34", "T35", "T36", "T37", "T38", "T44", "T46", "T47", "T62", "T63", "T64", "Outra"];

export function AthleteFormModal({ athlete, onClose, onSubmit }: Props) {
  const editing = !!athlete;
  const [nome, setNome] = useState(athlete?.nome ?? "");
  const [categoria, setCategoria] = useState(athlete?.categoria && athlete.categoria !== "—" ? athlete.categoria : "T11");
  const [numeroAtleta, setNumeroAtleta] = useState(athlete?.numeroAtleta ?? "");
  const [referenciaAngulo, setReferenciaAngulo] = useState(String(athlete?.referenciaAngulo ?? 45));
  const [referenciaVelocidade, setReferenciaVelocidade] = useState(
    athlete?.referenciaVelocidade != null ? String(athlete.referenciaVelocidade) : ""
  );
  const [erro, setErro] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Informe o nome do atleta.");
      return;
    }
    const ang = Number(referenciaAngulo);
    if (!Number.isFinite(ang) || ang < 0 || ang > 90) {
      setErro("Ângulo de referência deve estar entre 0° e 90°.");
      return;
    }
    const vel = referenciaVelocidade.trim() === "" ? undefined : Number(referenciaVelocidade);
    if (vel !== undefined && (!Number.isFinite(vel) || vel < 0 || vel > 15)) {
      setErro("Velocidade de referência deve estar entre 0 e 15 m/s.");
      return;
    }
    onSubmit({
      nome: nome.trim(),
      categoria,
      numeroAtleta: numeroAtleta.trim() || undefined,
      referenciaAngulo: ang,
      referenciaVelocidade: vel,
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-border overflow-hidden"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-sesi-red-500 text-white">
            <h2 className="font-bold text-base">{editing ? "Editar atleta" : "Novo atleta"}</h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-white/15 transition" aria-label="Fechar">
              <HiOutlineXMark className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <Field label="Nome">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: João Silva"
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-sesi-red-500/40"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sesi-red-500/40"
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nº atleta (opcional)">
                <input
                  value={numeroAtleta}
                  onChange={(e) => setNumeroAtleta(e.target.value)}
                  placeholder="Ex.: 123"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-sesi-red-500/40"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ângulo ref. (°)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={referenciaAngulo}
                  onChange={(e) => setReferenciaAngulo(e.target.value)}
                  min={0}
                  max={90}
                  step={0.5}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-sesi-red-500/40 tabular-nums"
                />
              </Field>
              <Field label="Vel. ref. (m/s, opcional)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={referenciaVelocidade}
                  onChange={(e) => setReferenciaVelocidade(e.target.value)}
                  min={0}
                  max={15}
                  step={0.1}
                  placeholder="Ex.: 9.5"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-sesi-red-500/40 tabular-nums"
                />
              </Field>
            </div>

            {erro && <p className="text-xs text-sesi-red-600 font-medium">{erro}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-track-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-bold bg-sesi-red-500 text-white hover:bg-sesi-red-600 transition shadow-sm shadow-sesi-red-500/30"
              >
                {editing ? "Salvar" : "Criar atleta"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1">{label}</span>
      {children}
    </label>
  );
}
