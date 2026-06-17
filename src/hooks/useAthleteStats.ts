"use client";
// Agrega o histórico LOCAL de tentativas em tudo que o Dashboard (/inicio) precisa:
// resumos por sessão, PRs, perfil técnico, ranking, insights, bio (PRs), etc.
// Reativo: ao salvar uma tentativa no /live, o dashboard se atualiza sozinho.
import { useEffect, useState } from "react";
import * as store from "@/lib/localStore";
import { buildPhases, fmtMeters } from "@/lib/phases";
import type {
  AthleteBio,
  AIInsight,
  AthleteRanking,
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
  insights: AIInsight[];
  leaderboard: AthleteRanking[];
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
  const cons = a.map((x) => x.metrics.consistency).filter((c): c is number => c != null);
  return {
    id: s.id,
    date: s.data,
    label: labelOf(s.data),
    peakVelocity: max(a.map((x) => x.metrics.peakVelocity)),
    avgAngle: avg(a.map((x) => x.metrics.startAngle).filter((v) => v > 0)),
    bestT100m: t100.length ? min(t100) : null, // null = ninguém completou 100m
    consistency: Math.round(avg(cons)),
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

function buildInsights(history: SessionSummary[], attempts: Attempt[]): AIInsight[] {
  if (!attempts.length) return [];
  const out: AIInsight[] = [];
  const bestVel = max(attempts.map((a) => a.metrics.peakVelocity));
  out.push({
    id: "ins-vel",
    severity: "positive",
    title: "Velocidade de pico",
    body: `Melhor velocidade registrada: ${bestVel.toFixed(2)} m/s em ${attempts.length} tentativa(s).`,
    metric: `${bestVel.toFixed(2)} m/s`,
  });
  if (history.length >= 2) {
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const delta = prev.peakVelocity > 0 ? ((last.peakVelocity - prev.peakVelocity) / prev.peakVelocity) * 100 : 0;
    out.push({
      id: "ins-trend",
      severity: delta >= 0 ? "positive" : "warning",
      title: delta >= 0 ? "Evolução positiva" : "Queda na velocidade",
      body: `Velocidade ${delta >= 0 ? "subiu" : "caiu"} ${Math.abs(delta).toFixed(0)}% vs a sessão anterior.`,
    });
  }
  return out;
}

function buildLeaderboard(): AthleteRanking[] {
  const sessPeak = (s: Session) => max(s.attempts.map((a) => a.metrics.peakVelocity));
  return store
    .getAthletes()
    .map((ath) => {
      const atts = store.getAttemptsByAthlete(ath.id);
      const t100 = atts.map((a) => a.metrics.t100m).filter((t): t is number => !!t && t > 0);
      const sessions = store.getSessionsByAthlete(ath.id); // mais novo → mais antigo
      // Tendência real: variação % da vel. de pico entre as 2 últimas sessões.
      const trend =
        sessions.length >= 2 && sessPeak(sessions[1]) > 0
          ? ((sessPeak(sessions[0]) - sessPeak(sessions[1])) / sessPeak(sessions[1])) * 100
          : 0;
      return {
        athleteId: ath.id,
        nome: ath.nome,
        categoria: ath.categoria,
        bestVel: max(atts.map((a) => a.metrics.peakVelocity)),
        bestT100m: t100.length ? min(t100) : 0,
        trend,
        lastSession: sessions[0] ? labelOf(sessions[0].data) : "—",
      };
    })
    .filter((r) => r.bestVel > 0) // só atletas com dados reais entram no ranking
    .sort((a, b) => b.bestVel - a.bestVel);
}

function compute(athleteId: string): AthleteStats {
  const sessions = store.getSessionsByAthlete(athleteId); // newest-first
  const attempts = store.getAttemptsByAthlete(athleteId);
  const athlete = store.getAthletes().find((a) => a.id === athleteId);
  const refAngle = athlete?.referenciaAngulo ?? 45;

  const history = sessions.map(summarize).reverse(); // cronológico p/ gráficos
  // Série por tentativa (cronológica): cada corrida vira 1 ponto no gráfico.
  const attemptSeries: AttemptPoint[] = attempts.map((a, idx) => ({
    label: String(idx + 1),
    peakVelocity: a.metrics.peakVelocity,
    bestT100m: a.metrics.tFinal ?? a.metrics.t100m ?? null,
    consistency: a.metrics.consistency ?? 0,
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
    insights: buildInsights(history, attempts),
    leaderboard: buildLeaderboard(),
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
