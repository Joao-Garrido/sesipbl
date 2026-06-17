"use client";
// Agrega o histórico LOCAL de tentativas em tudo que o Dashboard (/inicio) precisa:
// resumos por sessão, PRs, perfil técnico, ranking, insights, bio (PRs), etc.
// Reativo: ao salvar uma tentativa no /live, o dashboard se atualiza sozinho.
import { useEffect, useState } from "react";
import * as store from "@/lib/localStore";
import { buildPhases, fmtMeters } from "@/lib/phases";
import { exitAnglePeak, exitVelocityMean, repeatabilityScore } from "@/lib/analysis";
import type {
  AthleteBio,
  PRRecord,
  SessionSummary,
} from "@/lib/mock";
import type { Attempt, Session } from "@/lib/types";

// Score por fase já pronto para o gráfico (nome depende da distância da prova).
export interface PhaseScore {
  name: string;
  range: string;
  value: number; // % da velocidade de pico
  color: string;
}

// Ponto por tentativa (mesma forma usada pelo ProgressChart).
export interface AttemptPoint {
  label: string;
  peakVelocity: number;
  bestT100m: number | null; // tempo da tentativa (tFinal)
  consistency: number;
}

export interface AthleteStats {
  history: SessionSummary[]; // cronológico (mais antigo → mais novo)
  attemptSeries: AttemptPoint[]; // uma entrada por tentativa (cronológico)
  prs: PRRecord[];
  phaseScores: PhaseScore[];
  bio: AthleteBio;
  sessionsToday: number;
  todayAttempts: Attempt[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function labelOf(dateISO: string): string {
  return new Date(dateISO + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function max(arr: number[]): number {
  return arr.length ? arr.reduce((m, v) => (v > m ? v : m), arr[0]) : 0;
}
function min(arr: number[]): number {
  return arr.length ? arr.reduce((m, v) => (v < m ? v : m), arr[0]) : 0;
}
function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function summarize(s: Session): SessionSummary {
  const a = s.attempts;
  const t100 = a.map((x) => x.metrics.t100m).filter((t): t is number => !!t && t > 0);
  // Consistência = REPETIBILIDADE: o quanto os picos de velocidade das tentativas
  // se parecem entre si (CV). 1 tentativa (ou nenhuma medida) → 100% (baseline).
  const peakVels = a.map((x) => x.metrics.peakVelocity).filter((v) => v > 0);
  // Ângulo de saída via findPeaks (maior pico da curva de ângulo corporal).
  // Usa a melhor tentativa (maior pico de vel) que tenha curva.
  const withCurve = a.filter((x) => x.velocityCurve?.length > 3);
  const bestForAngle = withCurve.length
    ? withCurve.reduce((best, x) => (x.metrics.peakVelocity > best.metrics.peakVelocity ? x : best))
    : null;
  const exitAngle = bestForAngle ? exitAnglePeak(bestForAngle.velocityCurve) : 0;
  // Velocidade de saída: média dos primeiros 200 pontos da melhor tentativa.
  const exitVelocity = bestForAngle ? exitVelocityMean(bestForAngle.velocityCurve) : 0;
  // Ângulo de saída coletado: valor único do findPeaks do firmware (metrics.startAngle).
  const collectedAngle = bestForAngle?.metrics.startAngle ?? 0;
  return {
    id: s.id,
    date: s.data,
    label: labelOf(s.data),
    peakVelocity: max(a.map((x) => x.metrics.peakVelocity)),
    exitVelocity: +exitVelocity.toFixed(2),
    exitAngle,
    collectedAngle: +collectedAngle.toFixed(1),
    bestT100m: t100.length ? min(t100) : null,
    consistency: repeatabilityScore(peakVels) ?? 100,
    attemptsCount: a.length,
  };
}

// Velocidade média por fase (% do pico) da MELHOR tentativa — fases conforme a
// distância DELA (curtas viram trechos sem nome), não fixas em 100m.
function phaseScoresFrom(attempts: Attempt[]): PhaseScore[] {
  const best = attempts
    .filter((a) => a.velocityCurve?.length)
    .sort((a, b) => b.metrics.peakVelocity - a.metrics.peakVelocity)[0];
  if (!best) return [];
  const peak = best.metrics.peakVelocity || 1;
  return buildPhases(best.distance ?? 100).map((p) => {
    const pts = best.velocityCurve.filter((pt) => (pt.d ?? 0) >= p.lo && (pt.d ?? 0) < p.hi);
    const v = pts.length ? avg(pts.map((pt) => pt.v)) : 0;
    const faixa = `${fmtMeters(p.lo)}–${fmtMeters(p.hi)}m`;
    return {
      name: p.label || faixa,
      range: faixa,
      value: pts.length ? Math.min(100, Math.round((v / peak) * 100)) : 0,
      color: p.color,
    };
  });
}

// Distância mais frequente do atleta + melhor tempo nessa distância (para o PR).
function mainDistance(attempts: Attempt[]): number {
  const counts = new Map<number, number>();
  for (const a of attempts) {
    const d = a.distance ?? 100;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best = 100, bestN = -1;
  for (const [d, n] of counts) if (n > bestN) { best = d; bestN = n; }
  return best;
}
function bestTimeAt(attempts: Attempt[], dist: number): number | null {
  const ts = attempts
    .filter((a) => (a.distance ?? 100) === dist)
    .map((a) => a.metrics.tFinal ?? a.metrics.t100m)
    .filter((t): t is number => t != null && t > 0);
  return ts.length ? min(ts) : null;
}

function buildPRs(attempts: Attempt[], athleteId: string, refAngle: number): PRRecord[] {
  if (!attempts.length) return [];
  const prs: PRRecord[] = [];
  const bestVel = max(attempts.map((a) => a.metrics.peakVelocity));
  if (bestVel > 0) prs.push({ id: "pr-vel", athleteId, metric: "vel", label: "Velocidade máxima", value: `${bestVel.toFixed(2)} m/s`, date: "" });

  const md = mainDistance(attempts);
  const bestT = bestTimeAt(attempts, md);
  if (bestT != null) prs.push({ id: "pr-time", athleteId, metric: "tempo", label: `Melhor ${md}m`, value: `${bestT.toFixed(2)} s`, date: "" });

  const t10 = attempts.map((a) => a.metrics.t10m).filter((t): t is number => t != null && t > 0);
  if (t10.length) prs.push({ id: "pr-t10", athleteId, metric: "t10m", label: "Melhor saída (10m)", value: `${min(t10).toFixed(2)} s`, date: "" });

  // ângulo mais próximo da referência
  const angles = attempts.map((a) => a.metrics.startAngle).filter((v) => v > 0);
  if (angles.length) {
    const closest = angles.reduce((b, v) => (Math.abs(v - refAngle) < Math.abs(b - refAngle) ? v : b), angles[0]);
    prs.push({ id: "pr-ang", athleteId, metric: "ang", label: "Melhor ângulo de largada", value: `${closest.toFixed(1)}°`, date: "" });
  }
  return prs;
}

function compute(athleteId: string): AthleteStats {
  const sessions = store.getSessionsByAthlete(athleteId); // newest-first
  const attempts = store.getAttemptsByAthlete(athleteId);
  const athlete = store.getAthletes().find((a) => a.id === athleteId);
  const refAngle = athlete?.referenciaAngulo ?? 45;

  const history = sessions.map(summarize).reverse(); // cronológico p/ gráficos
  // Série por tentativa (cronológica): cada corrida vira 1 ponto no gráfico.
  // Consistência por tentativa = repetibilidade ACUMULADA: o quanto os picos de
  // velocidade até aquela tentativa (inclusive) se parecem entre si.
  const peakSeq = attempts.map((a) => a.metrics.peakVelocity);
  const attemptSeries: AttemptPoint[] = attempts.map((a, idx) => ({
    label: String(idx + 1),
    peakVelocity: a.metrics.peakVelocity,
    bestT100m: a.metrics.tFinal ?? a.metrics.t100m ?? null,
    consistency: repeatabilityScore(peakSeq.slice(0, idx + 1)) ?? 100,
  }));
  const angles = attempts.map((a) => a.metrics.startAngle).filter((v) => v > 0);
  // "PR de saída" = ângulo de largada mais próximo da referência do atleta.
  const bestAngle = angles.length
    ? angles.reduce((b, v) => (Math.abs(v - refAngle) < Math.abs(b - refAngle) ? v : b), angles[0])
    : 0;
  const md = mainDistance(attempts);

  const bio: AthleteBio = {
    athleteId,
    idade: 0,
    altura: 0,
    peso: 0,
    prSaida: +bestAngle.toFixed(1),
    prVelocidade: +max(attempts.map((a) => a.metrics.peakVelocity)).toFixed(2),
    prTime: bestTimeAt(attempts, md), // melhor tempo na distância principal (null se nenhum)
    prDistance: md,
    treinosSemana: 0,
    cargaTreino: 0,
    fadigaPercebida: 0,
    totalSessoes: sessions.length,
  };

  const todaySession = sessions.find((s) => s.data === todayISO());
  const todayAttempts = todaySession ? store.getAttemptsBySession(todaySession.id) : [];

  return {
    history,
    attemptSeries,
    prs: buildPRs(attempts, athleteId, refAngle),
    phaseScores: phaseScoresFrom(attempts),
    bio,
    sessionsToday: sessions.filter((s) => s.data === todayISO()).length,
    todayAttempts,
  };
}

export function useAthleteStats(athleteId: string): AthleteStats {
  const [stats, setStats] = useState<AthleteStats>(() => compute(athleteId));
  useEffect(() => {
    const load = () => setStats(compute(athleteId));
    load();
    return store.subscribe(load);
  }, [athleteId]);
  return stats;
}
