"use client";
// Coach Dashboard — driven by athlete switcher
// SESI brand (red + black) + Vinlet animations + Tufte data-ink ratio + a11y
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  HiOutlineBolt,
  HiOutlineCubeTransparent,
  HiOutlineClock,
  HiOutlinePlay,
  HiOutlineDocumentArrowDown,
  HiOutlineRocketLaunch,
} from "react-icons/hi2";
import Link from "next/link";
import { Header } from "@/shared/components/Header";
import { Card } from "@/shared/components/Card";
import { Badge } from "@/shared/components/Badge";
import { KPICard } from "@/shared/components/dashboard/KPICard";
import { mockUpcoming } from "@/lib/mock";
import { useAthletes } from "@/hooks/useAthletes";
import { useAthleteStats } from "@/hooks/useAthleteStats";
import { WelcomeHeader } from "./WelcomeHeader";
import { ProgressChart } from "./ProgressChart";
import { UpcomingSessions } from "./UpcomingSessions";
import { RecentAttempts } from "./RecentAttempts";
import { AthleteSwitcher } from "./AthleteSwitcher";
import { AthleteBioCard } from "./AthleteBioCard";
import { TrainingLoadChart } from "./TrainingLoadChart";
import { PRTimeline } from "./PRTimeline";

// Entrada enxuta: o dashboard é pesado (vários gráficos), então a animação é
// curta pra a troca de tela (/live -> /inicio) parecer instantânea.
const containerStagger = {
  animate: { transition: { staggerChildren: 0.02 } },
};
const itemFade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.14, ease: "easeOut" as const } },
};

type Metric = "peakVelocity" | "bestT100m" | "consistency";

export function CoachDashboard() {
  const { athletes } = useAthletes();
  const [athleteId, setAthleteId] = useState<string>("");
  const [metric, setMetric] = useState<Metric>("peakVelocity");
  const [progressView, setProgressView] = useState<"sessao" | "tentativa">("sessao");

  // Se o atleta selecionado deixar de existir (ex: placeholder apagado), volta pro 1º real.
  useEffect(() => {
    if (athletes.length && !athletes.some((a) => a.id === athleteId)) {
      setAthleteId(athletes[0].id);
    }
  }, [athletes, athleteId]);

  const athlete = athletes.find((a) => a.id === athleteId);
  const stats = useAthleteStats(athleteId);
  const { history, attemptSeries, bio, prs, todayAttempts: attempts } = stats;

  const last = history[history.length - 1];
  const prev = history[history.length - 2] ?? history[0]; // sessão imediatamente anterior

  const metrics = useMemo(() => {
    if (!last || !prev) return null;
    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);
    return {
      sparkVel: history.map((h) => h.peakVelocity),
      sparkExitVel: history.map((h) => h.exitVelocity),
      sparkAng: history.map((h) => h.collectedAngle),
      sparkCons: history.map((h) => h.consistency),
      deltaVel: pct(last.peakVelocity, prev.peakVelocity),
      deltaExitVel: pct(last.exitVelocity, prev.exitVelocity),
      deltaAng: pct(last.collectedAngle, prev.collectedAngle),
      deltaCons: last.consistency - prev.consistency,
    };
  }, [history, last, prev]);

  // Date formatted only on client to avoid hydration mismatch
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }));
  }, []);

  // Defaults seguros pra quando NAO tem dados (sem Firebase / sem persistencia).
  // Renderiza layout completo com zeros / "—" no lugar de mock fake.
  const safeBio = bio ?? {
    athleteId, idade: 0, altura: 0, peso: 0,
    prSaida: 0, prVelocidade: 0, prTime: null, prDistance: 100,
    treinosSemana: 0, cargaTreino: 0, fadigaPercebida: 0, totalSessoes: 0,
  };
  const safeAthlete = athlete ?? {
    id: athleteId, nome: "—", categoria: "—", numeroAtleta: "0",
    referenciaAngulo: 0, referenciaVelocidade: 0,
  };
  const emptySummary = {
    id: "", date: "", label: "—",
    peakVelocity: 0, exitVelocity: 0, exitAngle: 0, collectedAngle: 0,
    bestT100m: null, consistency: 0, attemptsCount: 0,
  };
  const safeLast = last ?? emptySummary;
  const safeMetrics = metrics ?? {
    sparkVel: [], sparkExitVel: [], sparkAng: [], sparkCons: [],
    deltaVel: 0, deltaExitVel: 0, deltaAng: 0, deltaCons: 0,
  };

  return (
    <>
      <Header
        rightSlot={
          <div className="flex items-center gap-2">
            <Link
              href="/relatorio"
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border hover:bg-track-50 transition-colors flex items-center gap-1.5"
            >
              <HiOutlineDocumentArrowDown className="w-4 h-4" /> Relatório
            </Link>
            <Link
              href="/live"
              className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-sesi-red-500 hover:bg-sesi-red-600 transition flex items-center gap-1.5 shadow-sm shadow-sesi-red-500/30"
            >
              <HiOutlinePlay className="w-4 h-4" /> Iniciar Sessão
            </Link>
          </div>
        }
      />

      <motion.div
        variants={containerStagger}
        initial="initial"
        animate="animate"
        className="flex-1 p-6 space-y-5 max-w-[1500px] w-full mx-auto"
      >
        {/* Welcome */}
        <motion.div variants={itemFade}>
          <WelcomeHeader
            coachName="Treinador"
            todayLocal={today}
            athletesCount={athletes.length}
            sessionsToday={stats.sessionsToday}
          />
        </motion.div>

        {/* Athlete switcher */}
        <motion.div variants={itemFade} className="bg-white rounded-xl border border-border p-3 flex items-center justify-between gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Atleta</span>
            <AthleteSwitcher athletes={athletes} selected={athleteId} onSelect={setAthleteId} />
          </div>
          <span className="text-xs text-text-muted">
            <span className="font-semibold text-text tabular-nums">{history.length}</span> sessões · última {safeLast.label}
          </span>
        </motion.div>

        {/* Bio card (left) + KPIs grid (right) */}
        <motion.section variants={itemFade} className="grid grid-cols-1 lg:grid-cols-3 gap-4" aria-label="Resumo do atleta">
          <div className="lg:col-span-1">
            <AthleteBioCard athlete={safeAthlete} bio={safeBio} />
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KPICard
              tone="red-vivid"
              title="Velocidade Pico"
              value={safeLast.peakVelocity.toFixed(2)}
              unit="m/s"
              delta={safeMetrics.deltaVel}
              deltaLabel="vs anterior"
              sparklineData={safeMetrics.sparkVel}
              icon={<HiOutlineBolt className="w-4 h-4" />}
            />
            <KPICard
              tone="wine"
              title="Velocidade de Saída"
              value={safeLast.exitVelocity.toFixed(2)}
              unit="m/s"
              delta={safeMetrics.deltaExitVel}
              deltaLabel="vs anterior"
              sparklineData={safeMetrics.sparkExitVel}
              icon={<HiOutlineRocketLaunch className="w-4 h-4" />}
            />
            <KPICard
              tone="wine"
              title="Ângulo de Saída"
              value={safeLast.collectedAngle.toFixed(1) + "°"}
              delta={safeMetrics.deltaAng}
              deltaLabel="vs anterior"
              sparklineData={safeMetrics.sparkAng}
              icon={<HiOutlineCubeTransparent className="w-4 h-4" />}
            />
            <KPICard
              tone="rose"
              title="Consistência"
              value={safeLast.consistency + "%"}
              delta={safeMetrics.deltaCons}
              deltaLabel="vs anterior"
              deltaUnit=" pts"
              sparklineData={safeMetrics.sparkCons}
              icon={<HiOutlineClock className="w-4 h-4" />}
            />
          </div>
        </motion.section>

        {/* Progress chart */}
        <motion.section variants={itemFade}>
          <Card
            title={progressView === "sessao" ? "Progresso por Sessão" : "Progresso por Tentativa"}
            headerRight={
              <div className="flex items-center gap-2 flex-wrap">
                {/* Sessão x Tentativa */}
                <div className="flex gap-1 bg-track-50 rounded-lg p-0.5" role="tablist">
                  {(["sessao", "tentativa"] as const).map((v) => (
                    <button
                      key={v}
                      role="tab"
                      aria-selected={progressView === v}
                      onClick={() => setProgressView(v)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                        progressView === v ? "bg-sesi-black text-white shadow-sm" : "text-text-muted hover:text-text"
                      }`}
                    >
                      {v === "sessao" ? "Sessão" : "Tentativa"}
                    </button>
                  ))}
                </div>
                {/* Métrica */}
                <div className="flex gap-1 bg-track-50 rounded-lg p-0.5" role="tablist">
                  {(["peakVelocity", "bestT100m", "consistency"] as Metric[]).map((m) => (
                    <button
                      key={m}
                      role="tab"
                      aria-selected={metric === m}
                      onClick={() => setMetric(m)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                        metric === m ? "bg-sesi-red-500 text-white shadow-sm" : "text-text-muted hover:text-text"
                      }`}
                    >
                      {m === "peakVelocity" ? "Vel" : m === "bestT100m" ? "Tempo" : "Consist"}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <ProgressChart data={progressView === "sessao" ? history : attemptSeries} metric={metric} />
            <p className="text-[11px] text-text-muted mt-2">
              {progressView === "sessao"
                ? "Um ponto por sessão (dia de treino)."
                : "Um ponto por tentativa, na ordem em que foram feitas."}
            </p>
          </Card>
        </motion.section>

        {/* Training load + PRs */}
        <motion.section variants={itemFade} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Volume de Treino" headerRight={<Badge variant="critical" size="sm">{history.length} sessões</Badge>}>
            <TrainingLoadChart data={history} />
            <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-text-muted">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "#D04F5C" }} />pouco (≤2)</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "#B91C2C" }} />ideal (3–4)</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "#6B1019" }} />muito (5+)</div>
            </div>
          </Card>
          <Card title="Recordes Pessoais" headerRight={<Badge variant="critical" size="sm" dot>{prs.length}</Badge>}>
            <PRTimeline prs={prs} />
          </Card>
        </motion.section>

        {/* Recent attempts */}
        <motion.section variants={itemFade}>
          <Card title="Tentativas — Sessão Atual" headerRight={<Badge variant="critical" size="sm" dot>Ao vivo</Badge>}>
            {attempts.length > 0 ? (
              <RecentAttempts attempts={attempts} />
            ) : (
              <p className="text-sm text-text-muted text-center py-6">Nenhuma tentativa registada hoje.</p>
            )}
          </Card>
        </motion.section>

        {/* Upcoming sessions */}
        <motion.section variants={itemFade}>
          <Card title="Próximos Treinos" headerRight={<Link href="/sessoes" className="text-xs font-semibold text-sesi-red-500 hover:underline">Ver agenda completa →</Link>}>
            <UpcomingSessions data={mockUpcoming} />
          </Card>
        </motion.section>
      </motion.div>
    </>
  );
}
