// Segmentação da corrida em 4 DIVISÕES IGUAIS (quartos) da distância selecionada,
// SEM nomes de fase. Adapta-se à prova: 100 m → 0-25-50-75-100; 20 m → 0-5-10-15-20.
// Cada quarto serve para mostrar a velocidade média naquele trecho.

export interface PhaseDef {
  label: string; // sempre "" — sem nome de fase (só a faixa de distância)
  lo: number;    // metros (início)
  hi: number;    // metros (fim)
  color: string;
}

const COLORS = ["#B91C2C", "#8C1521", "#6B1019", "#1A1A1A"];

export function buildPhases(distance: number): PhaseDef[] {
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
