"use client";

// Seletor de modo de calibracao DENTRO da plataforma (escolha do treinador).
// Reativo via useCalibrationMode (localStorage). Vale na hora pra Analise ao Vivo,
// sem reiniciar corrida (o hook le o modo em runtime).

import { useCalibrationMode } from "@/hooks/useCalibrationMode";
import type { CalibrationMode } from "@/lib/calibration";

const OPTIONS: { value: CalibrationMode; label: string; desc: string }[] = [
  {
    value: "firmware",
    label: "Confiar no firmware",
    desc: "Usa Vel_ms e Pulsos da ESP direto (diâmetro 0,068 m). Padrão.",
  },
  {
    value: "frontend",
    label: "Calibração de pista",
    desc: "Correção de campo: roda 0,05 m × fator 1,5, aplicada no navegador.",
  },
];

export function CalibrationSelector() {
  const { mode, setCalibrationMode } = useCalibrationMode();

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCalibrationMode(opt.value)}
              aria-pressed={active}
              className={`text-left rounded-lg border p-3 transition-colors ${
                active
                  ? "border-sesi-red-500 bg-sesi-red-500/5 ring-1 ring-sesi-red-500"
                  : "border-border hover:border-gray-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full border-[3px] ${
                    active ? "border-sesi-red-500" : "border-gray-300"
                  }`}
                />
                <span className="text-sm font-medium text-text">{opt.label}</span>
              </span>
              <span className="mt-1 block pl-[22px] text-xs text-text-muted leading-relaxed">
                {opt.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
