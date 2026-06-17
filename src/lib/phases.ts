// Segmentação de fases da corrida, dependente da distância da prova.
//
// Biomecânica (ver literatura de sprint): a corrida tem aceleração → velocidade
// máxima → desaceleração, e a velocidade MÁXIMA só é atingida por volta de
// 30–60 m (mais cedo em jovens/amadores). Logo:
//   - Provas longas (>=60 m): fases físicas nomeadas em distâncias FIXAS
//       Saída 0–10m · Aceleração 10–30m · Vel. Máx 30–60m · Manutenção 60m+
//   - Provas curtas (<60 m): são PURAMENTE aceleração — não existe "Vel. Máx"
//       nem "Manutenção". Mostramos trechos iguais SEM nome (só a faixa).

export interface PhaseDef {
  label: string; // "" = sem nome (prova de aceleração)
  lo: number;    // metros (início)
  hi: number;    // metros (fim)
  color: string;
}

const COLORS = ["#B91C2C", "#8C1521", "#6B1019", "#1A1A1A"];

// Distância a partir da qual a fase de velocidade máxima passa a existir.
export const NAMED_PHASES_MIN_M = 60;

export function buildPhases(distance: number): PhaseDef[] {
  if (distance >= NAMED_PHASES_MIN_M) {
    return [
      { label: "Saída",      lo: 0,  hi: 10,       color: COLORS[0] },
      { label: "Aceleração", lo: 10, hi: 30,       color: COLORS[1] },
      { label: "Vel. Máx",   lo: 30, hi: 60,       color: COLORS[2] },
      { label: "Manutenção", lo: 60, hi: distance, color: COLORS[3] },
    ];
  }
  // Prova curta = só aceleração: 4 trechos iguais, sem nome de fase.
  const n = 4;
  const step = distance / n;
  return Array.from({ length: n }, (_, i) => ({
    label: "",
    lo: +(i * step).toFixed(2),
    hi: +((i + 1) * step).toFixed(2),
    color: COLORS[i],
  }));
}

export const fmtMeters = (m: number): string =>
  Number.isInteger(m) ? String(m) : String(Math.round(m * 10) / 10);
