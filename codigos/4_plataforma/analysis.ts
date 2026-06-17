// Análises derivadas da curva de uma tentativa (velocidade/deslocamento por tempo).
// Tudo aqui é DERIVADO da curva já medida — não depende de novos campos do firmware.
//
// 1) Saída do bloco (primeiros 10% da prova): a fase mais importante. Expõe os
//    pontos da fase e o pico de velocidade nela.
// 2) Ângulo do corpo durante a corrida: modelo biomecânico de inclinação por
//    aceleração (ver bodyAngleCurve).

import type { VelocityPoint } from "./types";

// Fração da prova considerada "saída do bloco".
export const EXIT_FRACTION = 0.1; // primeiros 10%
const G = 9.81; // m/s²

/** Limite (m) dos primeiros 10% da prova. Piso de 0,5 m para provas muito curtas. */
export function exitWindowMeters(distance: number): number {
  return Math.max(0.5, distance * EXIT_FRACTION);
}

/** Pontos da curva dentro dos primeiros 10% da prova (saída do bloco). */
export function exitPhasePoints(curve: VelocityPoint[], distance: number): VelocityPoint[] {
  const lim = exitWindowMeters(distance);
  return curve.filter((p) => (p.d ?? 0) <= lim);
}

/** Pico de velocidade (m/s) dentro dos primeiros 10%. 0 se não houver pontos. */
export function exitPeakVelocity(curve: VelocityPoint[], distance: number): number {
  return exitPhasePoints(curve, distance).reduce((m, p) => (p.v > m ? p.v : m), 0);
}

export interface BodyAnglePoint {
  t: number; // s
  d: number; // m
  v: number; // m/s
  a: number; // m/s² — aceleração tangencial suavizada
  angle: number; // ° — ângulo do corpo
}

// Ângulo do corpo durante a corrida — MODELO BIOMECÂNICO DE INCLINAÇÃO POR ACELERAÇÃO.
//
// Durante a aceleração, o velocista inclina o tronco para que o eixo do corpo se
// alinhe à RESULTANTE de duas forças no centro de massa: o peso (g, para baixo) e a
// reação à aceleração horizontal (a, para trás). A inclinação do tronco em relação à
// vertical é, portanto, lean = atan(a / g):
//   - saída do bloco: aceleração máxima → tronco bem inclinado;
//   - velocidade estável (a → 0): tronco ereto.
// Adotamos a convenção pedida: 90° = corpo ereto, e a inclinação ABRE o ângulo acima
// de 90° na saída, fechando até 90° quando a corrida estabiliza:
//   ângulo_corpo = 90° + atan(a / g)
// (na desaceleração final, a < 0 → ângulo < 90°, ou seja, o corpo "recua" — fisicamente
//  correto.)
//
// `a` é a derivada da velocidade do encoder. Como a velocidade vem quantizada (~10 Hz),
// a aceleração crua é ruidosa; por isso `a` é estimada por REGRESSÃO LINEAR de v×t numa
// janela de ±windowS em torno de cada ponto (inclinação da reta = aceleração suavizada).
export function bodyAngleCurve(curve: VelocityPoint[], windowS = 0.35): BodyAnglePoint[] {
  const pts = curve
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((p, q) => p.t - q.t);
  const n = pts.length;
  if (n === 0) return [];

  const out: BodyAnglePoint[] = new Array(n);
  // Janela deslizante (dois ponteiros) sobre os pontos ordenados por tempo → O(n).
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const t0 = pts[i].t;
    while (lo < n && t0 - pts[lo].t > windowS) lo++;
    while (hi < n && pts[hi].t - t0 <= windowS) hi++;
    // regressão linear de v em função de t na janela [lo, hi)
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    const k = hi - lo;
    for (let j = lo; j < hi; j++) {
      const x = pts[j].t;
      const y = pts[j].v;
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    const denom = k * sxx - sx * sx;
    const a = k >= 2 && denom !== 0 ? (k * sxy - sx * sy) / denom : 0;
    const angle = 90 + (Math.atan2(a, G) * 180) / Math.PI;
    out[i] = {
      t: pts[i].t,
      d: pts[i].d ?? 0,
      v: pts[i].v,
      a: +a.toFixed(3),
      angle: +angle.toFixed(1),
    };
  }
  return out;
}
