// Exportação de tentativas para CSV pensada para o TREINADOR abrir no Excel (pt-BR):
//   - separador ";" e decimal com VÍRGULA (padrão do Excel brasileiro)
//   - BOM UTF-8 (acentos corretos)
//   - colunas de análise de sprint: tempo, vel. pico (m/s e km/h), vel. média,
//     parciais (t5/t10/t20…), ângulo de largada e desvio vs referência.
import type { Attempt } from "./types";
import { bodyAngleCurve, exitPeakVelocity, exitPhasePoints } from "./analysis";

export interface CsvAthleteInfo {
  nome: string;
  categoria: string;
  refAngulo: number;
}

const SPLIT_MARKS = [5, 10, 20, 30, 60, 100];

// tempo ao cruzar `m` metros (primeiro ponto da curva com deslocamento >= m).
function splitAt(a: Attempt, m: number): number | null {
  const p = a.velocityCurve.find((pt) => (pt.d ?? 0) >= m);
  return p ? p.t : null;
}

// número com vírgula decimal; vazio se nulo.
function num(v: number | null | undefined, dec = 2): string {
  if (v == null || Number.isNaN(v)) return "";
  return v.toFixed(dec).replace(".", ",");
}

function esc(s: string): string {
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function attemptsToCsv(attempts: Attempt[], info: (athleteId: string) => CsvAthleteInfo): string {
  // Só inclui colunas de parcial até a maior prova exportada (evita colunas vazias).
  const maxProva = attempts.reduce((m, a) => Math.max(m, a.distance ?? 100), 0);
  const splits = SPLIT_MARKS.filter((m) => m <= maxProva);

  const header = [
    "Atleta", "Categoria", "Data", "Hora", "Prova (m)", "Tentativa", "Status", "Deslocamento (m)",
    "Tempo (s)", "Vel. pico (m/s)", "Vel. pico (km/h)", "Vel. pico saída 10% (m/s)", "Vel. média (m/s)",
    ...splits.map((m) => `t ${m}m (s)`),
    "Ângulo largada (°)", "Desvio ângulo (°)",
  ];

  const rows = attempts.map((a) => {
    const i = info(a.athleteId);
    const d = new Date(a.startedAt);
    const prova = a.distance ?? 100;
    const curve = a.velocityCurve;
    const maxD = curve.length ? Math.max(...curve.map((p) => p.d ?? 0)) : 0;
    const lastT = curve.length ? curve[curve.length - 1].t : 0;
    const tempo = a.metrics.tFinal ?? a.metrics.t100m ?? null;
    const velMedia = tempo && tempo > 0 ? prova / tempo : lastT > 0 ? maxD / lastT : null;
    const peak = a.metrics.peakVelocity;
    // pico da saída (primeiros 10%): usa a métrica salva; cai pra curva em dados antigos.
    const exitPeak = a.metrics.exitPeakVelocity ?? exitPeakVelocity(curve, prova);
    const desvio = a.metrics.startAngle - i.refAngulo;
    return [
      esc(i.nome), esc(i.categoria),
      d.toLocaleDateString("pt-BR"), d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      String(prova), String(a.numero), a.status, num(maxD, 2),
      num(tempo), num(peak), num(peak * 3.6), num(exitPeak), num(velMedia),
      ...splits.map((m) => num(splitAt(a, m))),
      num(a.metrics.startAngle, 1), num(desvio, 1),
    ];
  });

  return [header.map(esc), ...rows].map((r) => r.join(";")).join("\r\n");
}

// CSV ponto-a-ponto da SAÍDA DO BLOCO (primeiros 10% da prova) — TODAS as amostras da
// fase, com tempo, deslocamento, velocidade e o ângulo do corpo modelado. É o detalhe
// fino da fase mais importante (a tabela agregada só traz o pico).
export function exitPhaseToCsv(attempt: Attempt, info: (athleteId: string) => CsvAthleteInfo): string {
  const i = info(attempt.athleteId);
  const prova = attempt.distance ?? 100;
  // usa a curva de saída em alta densidade quando existir; senão filtra a curva geral.
  const pts = attempt.exitCurve?.length
    ? attempt.exitCurve
    : exitPhasePoints(attempt.velocityCurve, prova);
  const angleByT = new Map(bodyAngleCurve(pts).map((p) => [p.t, p.angle]));

  const header = [
    "Atleta", "Categoria", "Prova (m)", "Tentativa",
    "Tempo (s)", "Deslocamento (m)", "Velocidade (m/s)", "Velocidade (km/h)", "Ângulo corpo (°)",
  ];
  const rows = pts.map((p) => [
    esc(i.nome), esc(i.categoria), String(prova), String(attempt.numero),
    num(p.t, 3), num(p.d ?? 0, 3), num(p.v), num(p.v * 3.6), num(angleByT.get(p.t) ?? null, 1),
  ]);
  return [header.map(esc), ...rows].map((r) => r.join(";")).join("\r\n");
}

// Cabeçalho do CSV bruto — EXATAMENTE as colunas que o firmware (hardware_final.ino)
// imprime na serial, na mesma ordem.
export const ESP_RAW_HEADER = "time,Ax,Angulo_graus,Pulsos,Vel_ms";

// CSV BRUTO LITERAL da ESP: o stream cru da tentativa exatamente como chegou pela
// serial — colunas time,Ax,Angulo_graus,Pulsos,Vel_ms, separador VÍRGULA e PONTO
// decimal, com a mesma precisão do firmware (Ax 4, Ângulo 2, Vel 3 casas; time e
// Pulsos inteiros). Sem colunas de atleta, sem reprocessamento, sem BOM — idêntico
// ao log do server.py e ao que os scripts Python (angulo_fio.py, etc.) leem.
export function espRawToCsv(attempt: Attempt, includeHeader = true): string {
  const rows = attempt.rawSamples ?? [];
  const lines = rows.map((r) =>
    [
      Math.round(r.time),
      r.Ax.toFixed(4),
      r.Angulo_graus.toFixed(2),
      Math.round(r.Pulsos),
      r.Vel_ms.toFixed(3),
    ].join(",")
  );
  return includeHeader ? [ESP_RAW_HEADER, ...lines].join("\n") : lines.join("\n");
}

export function downloadCsv(filename: string, content: string, withBom = true): void {
  // BOM p/ o Excel reconhecer UTF-8 (acentos). O CSV bruto literal passa withBom=false
  // para ficar byte-idêntico ao log do server.py / ao que os scripts Python esperam.
  const payload = withBom ? "﻿" + content : content;
  const blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
