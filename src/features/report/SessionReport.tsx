"use client";
// Relatório de sessão pós-tentativa — lê tentativas salvas localmente.
import { useEffect, useMemo, useState } from "react";
import { useAthletes } from "@/hooks/useAthletes";
import { useAttempts } from "@/hooks/useAttempts";
import { useSessions } from "@/hooks/useSessions";
import * as store from "@/lib/localStore";
import { attemptsToCsv, exitPhaseToCsv, downloadCsv } from "@/lib/exportCsv";
import {
  bodyAngleCurve,
  exitPeakVelocity,
  exitPhasePoints,
  exitWindowMeters,
} from "@/lib/analysis";
import type { Attempt } from "@/lib/types";
import { Card } from "@/shared/components/Card";
import { Header } from "@/shared/components/Header";
import { Badge } from "@/shared/components/Badge";
import { ComparisonChart } from "./ComparisonChart";
import { AttemptsTable } from "./AttemptsTable";
import { PhaseProfile } from "./PhaseProfile";
import { ExitVelocityChart } from "@/features/analysis/ExitVelocityChart";
import { BodyAngleChart } from "@/features/analysis/BodyAngleChart";
import { HiOutlineDocumentArrowDown, HiOutlineTableCells } from "react-icons/hi2";

type Scope = "sel" | "sessao" | "todas";

// Distância (prova) mais frequente da lista.
function modeDistance(attempts: Attempt[]): number {
  const c = new Map<number, number>();
  for (const a of attempts) {
    const d = a.distance ?? 100;
    c.set(d, (c.get(d) ?? 0) + 1);
  }
  let best = 100, bestN = -1;
  for (const [d, n] of c) if (n > bestN) { best = d; bestN = n; }
  return best;
}

export function SessionReport() {
  const { athletes } = useAthletes();
  const [athleteId, setAthleteId] = useState<string>("atl-teste");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const sessions = useSessions(athleteId);

  // Lê ?athlete=&session= da URL uma vez.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = p.get("athlete");
    const s = p.get("session");
    if (a) setAthleteId(a);
    if (s) setSessionId(s);
    setBootstrapped(true);
  }, []);

  // Reconcilia o atleta selecionado (após ler a URL): se não existe mais, usa o 1º.
  useEffect(() => {
    if (!bootstrapped) return;
    if (athletes.length && !athletes.some((a) => a.id === athleteId)) {
      setAthleteId(athletes[0].id);
    }
  }, [athletes, athleteId, bootstrapped]);

  // Mantém uma sessão válida selecionada (default = mais recente do atleta).
  useEffect(() => {
    if (!bootstrapped) return;
    if (sessions.length === 0) {
      setSessionId(null);
      return;
    }
    if (!sessionId || !sessions.some((s) => s.id === sessionId)) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId, bootstrapped]);

  const { attempts } = useAttempts(sessionId);
  const athlete = athletes.find((a) => a.id === athleteId);
  const infoOf = (id: string) => {
    const a = athletes.find((x) => x.id === id);
    return { nome: a?.nome ?? id, categoria: a?.categoria ?? "—", refAngulo: a?.referenciaAngulo ?? 45 };
  };

  // Provas presentes na sessão + prova selecionada para o comparativo.
  const distances = useMemo(
    () => [...new Set(attempts.map((a) => a.distance ?? 100))].sort((x, y) => x - y),
    [attempts],
  );
  const [provaDistance, setProvaDistance] = useState<number | null>(null);
  useEffect(() => {
    if (attempts.length === 0) { setProvaDistance(null); return; }
    if (provaDistance == null || !distances.includes(provaDistance)) {
      setProvaDistance(modeDistance(attempts));
    }
  }, [attempts, distances, provaDistance]);

  // Tentativas da prova escolhida + seleção (quais entram no comparativo/CSV).
  const runs = useMemo(
    () => attempts.filter((a) => (a.distance ?? 100) === provaDistance),
    [attempts, provaDistance],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds(new Set(runs.map((a) => a.id)));
  }, [runs]);
  const selectedRuns = useMemo(() => runs.filter((a) => selectedIds.has(a.id)), [runs, selectedIds]);
  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  // Tentativa em destaque (completa mais recente da prova) para o perfil por fase.
  const featured = useMemo(() => {
    const comp = runs.filter((a) => a.status === "completa");
    if (comp.length) return comp.reduce((m, a) => (a.startedAt > m.startedAt ? a : m));
    return runs[runs.length - 1] ?? attempts[attempts.length - 1];
  }, [runs, attempts]);

  // Saída do bloco (1ºs 10%) e ângulo do corpo da tentativa em destaque — derivados da
  // curva. Usa exitCurve (alta densidade) quando existe; senão filtra a curva geral.
  const featuredExit = useMemo(() => {
    if (!featured) return { pts: [], window: 0, peak: 0 };
    const dist = featured.distance ?? 100;
    const pts = featured.exitCurve?.length ? featured.exitCurve : exitPhasePoints(featured.velocityCurve, dist);
    return {
      pts,
      window: exitWindowMeters(dist),
      peak: featured.metrics.exitPeakVelocity ?? exitPeakVelocity(featured.velocityCurve, dist),
    };
  }, [featured]);
  const featuredBodyAngle = useMemo(
    () => (featured ? bodyAngleCurve(featured.velocityCurve) : []),
    [featured],
  );

  const currentSession = sessions.find((s) => s.id === sessionId);
  const dataLabel = currentSession
    ? new Date(currentSession.data + "T00:00:00").toLocaleDateString("pt-BR")
    : new Date().toLocaleDateString("pt-BR");

  const [scope, setScope] = useState<Scope>("sel");
  function exportCsv() {
    const list =
      scope === "sel" ? selectedRuns :
      scope === "sessao" ? attempts :
      store.getAttemptsByAthlete(athleteId);
    if (!list.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const nome = (athlete?.nome ?? "atleta").replace(/\s+/g, "_");
    downloadCsv(`tentativas_${nome}_${stamp}.csv`, attemptsToCsv(list, infoOf));
  }

  // CSV ponto-a-ponto da saída do bloco (todos os pontos dos 1ºs 10%) da tentativa em destaque.
  function exportExitCsv() {
    if (!featured) return;
    const stamp = new Date(featured.startedAt).toISOString().slice(0, 10);
    const nome = (athlete?.nome ?? "atleta").replace(/\s+/g, "_");
    downloadCsv(`saida_10pct_${nome}_T${featured.numero}_${stamp}.csv`, exitPhaseToCsv(featured, infoOf));
  }

  return (
    <>
      <Header
        athleteName={athlete?.nome}
        rightSlot={
          <div className="flex items-center gap-2">
            <select
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-border bg-white"
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.nome} — {a.categoria}</option>
              ))}
            </select>
            {sessions.length > 0 && (
              <select
                value={sessionId ?? ""}
                onChange={(e) => setSessionId(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-border bg-white"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.data + "T00:00:00").toLocaleDateString("pt-BR")} · {s.attempts.length} tent.
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-[1400px] w-full mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Relatório de Sessão</h1>
            <span className="text-sm text-text-muted">{dataLabel}</span>
          </div>
          {/* Exportar */}
          <div className="flex items-center gap-2 print:hidden">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white"
              title="O que exportar"
            >
              <option value="sel">Tentativas selecionadas ({selectedRuns.length})</option>
              <option value="sessao">Sessão inteira ({attempts.length})</option>
              <option value="todas">Todas as sessões do atleta</option>
            </select>
            <button
              onClick={exportCsv}
              disabled={attempts.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-border hover:bg-track-50 transition disabled:opacity-40"
            >
              <HiOutlineTableCells className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={() => window.print()}
              disabled={attempts.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-sesi-black text-white hover:bg-sesi-charcoal transition disabled:opacity-40"
            >
              <HiOutlineDocumentArrowDown className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {attempts.length === 0 ? (
          <Card className="border-dashed text-center">
            <p className="text-sm text-text-muted">
              Sem tentativas para este atleta. Faça uma corrida em{" "}
              <span className="font-bold text-sesi-red-500">Análise ao Vivo</span> e ela aparece aqui.
            </p>
          </Card>
        ) : (
          <>
            {/* Comparativo overlay (por prova) */}
            <Card
              title="Comparativo de Tentativas"
              headerRight={<Badge variant="primary" size="sm">{selectedRuns.length}/{runs.length} · {provaDistance ?? "—"}m</Badge>}
            >
              {/* Seletor de prova (só se houver mais de uma distância na sessão) */}
              {distances.length > 1 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold mr-1">Prova</span>
                  {distances.map((d) => (
                    <button
                      key={d}
                      onClick={() => setProvaDistance(d)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                        provaDistance === d ? "bg-sesi-red-500 text-white shadow-sm" : "bg-track-50 text-text-muted hover:text-text"
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              )}
              {/* Seleção de tentativas a comparar */}
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold mr-1">Tentativas</span>
                {runs.map((a) => {
                  const on = selectedIds.has(a.id);
                  const parcial = a.status !== "completa";
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                        on ? "bg-track-700 text-white border-track-700" : "bg-white text-text-muted border-border"
                      }`}
                      title={parcial ? "Parcial (não chegou ao fim)" : "Completa"}
                    >
                      {on ? "☑" : "☐"} T{a.numero}{parcial ? " ·parcial" : ""}
                    </button>
                  );
                })}
              </div>

              {selectedRuns.length > 0 && provaDistance != null ? (
                <ComparisonChart attempts={selectedRuns} distance={provaDistance} />
              ) : (
                <p className="text-sm text-text-muted text-center py-10">Selecione ao menos uma tentativa.</p>
              )}
              <p className="text-xs text-text-muted mt-2">
                Prova de <span className="font-semibold">{provaDistance ?? "—"}m</span>. Tentativa completa mais recente em{" "}
                <span className="font-semibold" style={{ color: "#2D4F4F" }}>verde-petróleo</span>; demais em cinza;{" "}
                <span className="font-semibold">parciais tracejadas</span>.
              </p>
            </Card>

            {/* Tabela de métricas (todas as tentativas da sessão) */}
            <Card title="Métricas por Tentativa">
              <AttemptsTable attempts={attempts} />
            </Card>

            {/* Perfil por fase + ângulos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Perfil de Velocidade por Fase">
                {featured ? <PhaseProfile attempt={featured} /> : <p className="text-sm text-text-muted">Sem dados.</p>}
              </Card>
              <Card title="Histórico de Ângulo na Largada">
                <div className="space-y-2">
                  {attempts.map((a) => {
                    const ref = athlete?.referenciaAngulo ?? 45;
                    const delta = a.metrics.startAngle - ref;
                    const ok = Math.abs(delta) <= 5;
                    return (
                      <div key={a.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="text-sm">Tentativa #{a.numero}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums text-sm">{a.metrics.startAngle}°</span>
                          <Badge variant={ok ? "optimal" : Math.abs(delta) <= 10 ? "warning" : "critical"} size="sm">
                            {delta > 0 ? "+" : ""}{delta.toFixed(0)}° vs ref
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Saída do bloco (1ºs 10%) + ângulo do corpo da tentativa em destaque */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card
                title={`Velocidade na Saída do Bloco${featured ? ` · T${featured.numero}` : ""}`}
                headerRight={
                  <div className="flex items-center gap-2">
                    {featuredExit.peak > 0 && (
                      <Badge variant="critical" size="sm">pico {featuredExit.peak.toFixed(2)} m/s</Badge>
                    )}
                    <button
                      onClick={exportExitCsv}
                      disabled={!featured || featuredExit.pts.length < 2}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-border hover:bg-track-50 transition disabled:opacity-40 print:hidden"
                      title="Exportar todos os pontos dos primeiros 10% em CSV"
                    >
                      <HiOutlineTableCells className="w-3.5 h-3.5" /> CSV pontos
                    </button>
                  </div>
                }
              >
                <ExitVelocityChart points={featuredExit.pts} windowM={featuredExit.window} />
                <p className="text-[11px] text-text-muted mt-2">
                  Velocidade instantânea nos primeiros 10% da prova ({featuredExit.window.toFixed(1)} m) — a fase de saída do bloco. O CSV traz todos os pontos da fase.
                </p>
              </Card>
              <Card title={`Ângulo do Corpo durante a corrida${featured ? ` · T${featured.numero}` : ""}`}>
                <BodyAngleChart points={featuredBodyAngle} />
                <p className="text-[11px] text-text-muted mt-2">
                  Modelo de inclinação por aceleração: <span className="font-semibold">90° = corpo ereto</span>. Começa acima de 90° na saída (tronco inclinado) e converge para 90° quando a velocidade estabiliza.
                </p>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
