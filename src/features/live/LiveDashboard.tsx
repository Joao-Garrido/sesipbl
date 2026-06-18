"use client";
// REQ-13 v2: Tela tempo real completa — raw + processado + hardware + splits + chronometer
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  HiOutlineBolt,
  HiOutlineArrowLongRight,
  HiOutlineCubeTransparent,
  HiOutlinePlay,
  HiOutlineStop,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { useAutoLiveSession, LIVE_SOURCE, IS_DEMO } from "@/hooks/useAutoLiveSession";
import { useAthletes } from "@/hooks/useAthletes";
import { useBridgeStatus } from "@/hooks/useBridgeStatus";
import { startAttemptControl, stopAttemptControl, todaySessionId } from "@/lib/liveControl";
import { saveAttempt, getAttemptsBySession } from "@/lib/localStore";
import {
  exitPeakVelocity,
  exitVelocityFromRaw,
  exitPhasePoints,
  smoothCurveVelocity,
  launchAngleFromRaw,
  N_EXIT_POINTS,
} from "@/lib/analysis";
import type { Attempt, AttemptMetrics, LiveFrame, VelocityPoint } from "@/lib/types";
import { Card } from "@/shared/components/Card";
import { StatCard } from "@/shared/components/StatCard";
import { Header } from "@/shared/components/Header";
import { Badge } from "@/shared/components/Badge";
import { Chronometer } from "./Chronometer";
import { PhaseIndicator } from "./PhaseIndicator";
import { DualMetricChart } from "./DualMetricChart";
import { ExitVelocityChart } from "@/features/analysis/ExitVelocityChart";

const containerStagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const itemFade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } },
};

// Reduz a curva a no máximo `max` pontos (mantendo o último) — usado tanto para
// os gráficos quanto para o que é salvo no histórico (evita arquivos enormes).
function downsampleCurve(curve: VelocityPoint[], max: number): VelocityPoint[] {
  if (curve.length <= max) return curve;
  const step = Math.ceil(curve.length / max);
  const out = curve.filter((_, i) => i % step === 0);
  const last = curve[curve.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function LiveDashboard() {
  const router = useRouter();
  const { athletes } = useAthletes();
  const [athleteId, setAthleteId] = useState<string>("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNum, setAttemptNum] = useState(0);
  // Resultado do último encerramento — feedback explícito de salvamento + save manual.
  // "saved": gravada; "trivial": abaixo do mínimo (segura p/ salvar à mão); "empty": sem dados.
  const [saveResult, setSaveResult] = useState<{
    status: "saved" | "trivial" | "empty";
    attempt: Attempt | null;
    maxD: number;
    peak: number;
    points: number;
  } | null>(null);
  const [distance, setDistance] = useState(100); // distância-alvo da prova (m)
  const startedAtRef = useRef<number>(0);
  // Ângulo de largada — calculado do stream CRU da ESP (taxa plena) com o MESMO
  // algoritmo do angulo_fio.py (passa-baixa Butterworth 5 Hz + find_peaks). Ver
  // launchAngleFromRaw. Atualiza ao vivo conforme chegam amostras.
  const [launchAngle, setLaunchAngle] = useState(0);

  const athlete = athletes.find((a) => a.id === athleteId);
  const { isLive, current: liveCurrent, curve: liveCurve, hardware, calibrating, getRawSamples } = useAutoLiveSession(attemptId, athleteId);
  const bridge = useBridgeStatus();

  // Congela a última tentativa: ao encerrar, o hook zera o stream (attemptId=null).
  // Guardamos um snapshot para o treinador revisar até iniciar outra ou clicar em limpar.
  const [frozen, setFrozen] = useState<{
    current: LiveFrame | null;
    curve: VelocityPoint[];
  } | null>(null);

  // Valores exibidos: snapshot congelado tem prioridade sobre o stream vivo (vazio pós-stop).
  const current = frozen ? frozen.current : liveCurrent;
  const curve = frozen ? frozen.curve : liveCurve;

  // Sinal perdido durante a captura: socket caiu (isLive=false) OU parou de chegar
  // frame (>2s → hardware "fail"). Só depois do 1º frame, pra não piscar no início.
  const signalLost = !!attemptId && !!current && (!isLive || hardware.esp32 === "fail");

  // Se o atleta selecionado for removido, cai pro 1º disponível (não durante captura).
  useEffect(() => {
    if (!isLive && athletes.length && !athletes.some((a) => a.id === athleteId)) {
      setAthleteId(athletes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes, athleteId, isLive]);

  const markers = useMemo(() => {
    if (curve.length < 4) return { peakVelTime: undefined };
    const peakVel = curve.reduce((max, p) => (p.v > max.v ? p : max), curve[0]);
    return { peakVelTime: peakVel.t };
  }, [curve]);

  // Curva amostrada (≤800 pts) só para os gráficos — mantém o render leve. A curva
  // completa (`curve`) segue intacta para métricas e salvamento.
  const chartCurve = useMemo(() => downsampleCurve(curve, 800), [curve]);

  // Saída = os 1ºs N_EXIT_POINTS pontos (mesma janela do ajuste_plot_vel.py, NÃO os 10%).
  // O gráfico mostra a velocidade (suavizada) desse trecho; windowM = distância no fim dele.
  const exitSlice = useMemo(() => curve.slice(0, N_EXIT_POINTS), [curve]);
  const exitPts = useMemo(() => smoothCurveVelocity(downsampleCurve(exitSlice, 800)), [exitSlice]);
  const exitWindowM = exitSlice.length ? (exitSlice[exitSlice.length - 1].d ?? 0) : 0;
  // Vel. de saída EXATA do ajuste_plot_vel.py: média dos 1ºs N_EXIT_POINTS valores de
  // Vel_ms CRUS da ESP (rawSamples, sem calibração). Recalcula conforme o stream cresce.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exitMean = useMemo(() => exitVelocityFromRaw(getRawSamples()), [curve]);

  // Ângulo de largada: recalcula do stream CRU completo da ESP (taxa plena) a cada
  // novo frame, com o mesmo filtro do angulo_fio.py — assim o valor exibido BATE com
  // o que o script Python dá no CSV bruto (não pega espiga de ruído do sinal cru).
  useEffect(() => {
    if (!attemptId || !current) return;
    setLaunchAngle(launchAngleFromRaw(getRawSamples()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, attemptId]);

  // Auto-stop quando atinge a distância-alvo (10/20/100/custom)
  useEffect(() => {
    if (!isLive || !attemptId) return;
    const d = current?.displacement ?? 0;
    if (d >= distance) {
      stopAttempt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.displacement, isLive, attemptId, distance]);

  async function startAttempt() {
    const newAttemptId = `att-${Date.now()}`;
    // Em modo Firebase: avisa o bridge Python ANTES de começar a escutar.
    // Em modo mock: startAttemptControl é no-op, segue direto.
    try {
      await startAttemptControl(newAttemptId, athleteId, todaySessionId(athleteId));
    } catch (err) {
      console.error("startAttemptControl falhou:", err);
      return; // não inicia visualização se o controle falhou
    }
    startedAtRef.current = Date.now();
    setLaunchAngle(0);
    setFrozen(null); // descongela: nova tentativa volta ao stream vivo
    setSaveResult(null); // limpa o aviso de salvamento da tentativa anterior
    setAttemptNum((n) => n + 1);
    setAttemptId(newAttemptId);
  }

  // Monta a tentativa concluída (métricas + curva + stream cru) a partir dos dados
  // AINDA VIVOS. NÃO salva e NÃO aplica o filtro de "trivial" — quem decide salvar é
  // stopAttempt (auto) ou forceSave (manual). Retorna null só quando não dá pra montar
  // (demo, sem attemptId, ou amostras de menos). Os limiares vêm junto p/ o feedback.
  function buildAttempt(): { attempt: Attempt; maxD: number; peak: number; points: number } | null {
    if (IS_DEMO) return null; // modo demo: o stream é simulado, não salva como tentativa real
    // `curve` vem do hook a TAXA PLENA e cobre o run inteiro (splits sem perda de amostra).
    const full = curve;
    if (!attemptId || full.length < 5) return null;
    const maxDispRaw = full[full.length - 1]?.d ?? current?.displacement ?? 0;
    const peakVelocity = full.reduce((m, p) => (p.v > m ? p.v : m), 0);

    const reachedTarget = maxDispRaw >= distance;
    const sessionId = todaySessionId(athleteId);
    const existing = getAttemptsBySession(sessionId);
    const prior = existing.find((a) => a.id === attemptId);
    const numero = prior ? prior.numero : existing.length + 1;
    // ângulo de largada calculado do stream CRU completo (taxa plena) com o filtro do
    // angulo_fio.py — o valor salvo bate com o script Python no CSV bruto.
    const startAngle = launchAngleFromRaw(getRawSamples());
    const firstTimeAt = (m: number) => full.find((p) => (p.d ?? 0) >= m)?.t;

    const metrics: AttemptMetrics = {
      peakVelocity: +peakVelocity.toFixed(2),
      startAngle,
      exitPeakVelocity: +exitPeakVelocity(full, distance).toFixed(2), // pico nos 1ºs 10%
      // vel. de saída EXATA do ajuste_plot_vel.py: média dos 1ºs N_EXIT_POINTS valores de
      // Vel_ms CRUS (rawSamples) — é o valor final salvo/mostrado, idêntico ao Python.
      exitMeanVelocity: +exitVelocityFromRaw(getRawSamples()).toFixed(2),
      t10m: firstTimeAt(10), // undefined se não cruzou 10m (sem 0.00s falso)
      t30m: firstTimeAt(30),
      t100m: firstTimeAt(100),
      tFinal: firstTimeAt(distance), // tempo até a distância-alvo da prova
    };

    const attempt: Attempt = {
      id: attemptId,
      sessionId,
      athleteId,
      numero,
      distance,
      // só "completa" se cruzou a distância-alvo; senão é parcial (encerrada antes)
      status: reachedTarget ? "completa" : "parcial",
      metrics,
      velocityCurve: downsampleCurve(full, 1000),
      // saída do bloco em alta densidade (≤200 pts só dos 1ºs 10%): a fase mais
      // importante não perde amostras como na velocityCurve (reduzida p/ a prova toda).
      exitCurve: downsampleCurve(exitPhasePoints(full, distance), 200),
      // Stream CRU da ESP à taxa plena, exatamente como recebido — para o CSV bruto
      // literal (time,Ax,Angulo_graus,Pulsos,Vel_ms). Cópia: o ref é zerado no stop.
      rawSamples: getRawSamples().slice(),
      startedAt: startedAtRef.current || Date.now(),
      finishedAt: Date.now(),
    };
    return { attempt, maxD: maxDispRaw, peak: peakVelocity, points: full.length };
  }

  async function stopAttempt() {
    // Monta a tentativa ANTES de limpar o stream (setAttemptId(null) zera curva/raw).
    const built = buildAttempt();
    if (built) {
      // Tentativa trivial (giro curto/lento ou start-stop acidental): NÃO salva sozinha,
      // mas guarda p/ "Salvar mesmo assim". Acima do mínimo: salva automaticamente.
      const trivial = built.maxD < 2 || built.peak < 0.5;
      if (trivial) {
        setSaveResult({ status: "trivial", attempt: built.attempt, maxD: built.maxD, peak: built.peak, points: built.points });
      } else {
        saveAttempt(built.attempt);
        setSaveResult({ status: "saved", attempt: built.attempt, maxD: built.maxD, peak: built.peak, points: built.points });
      }
    } else if (!IS_DEMO) {
      // Não deu pra montar: nenhuma (ou quase nenhuma) amostra chegou da ESP.
      setSaveResult({ status: "empty", attempt: null, maxD: 0, peak: 0, points: curve.length });
    }
    // congela os valores vivos para o treinador revisar (sobrevive ao setAttemptId(null))
    setFrozen({ current: liveCurrent, curve: liveCurve });
    setAttemptId(null);
    try {
      await stopAttemptControl();
    } catch (err) {
      console.error("stopAttemptControl falhou:", err);
    }
  }

  // Botão extra "para garantir": (re)grava a tentativa (idempotente por id — inclui
  // as triviais abaixo do mínimo) e redireciona para o relatório da sessão, que mostra
  // tudo (comparativo, parciais, fases, ângulo, exports). saveAttempt grava no
  // localStorage de forma síncrona, então o relatório já lê a tentativa ao abrir.
  function saveAndOpen() {
    const a = saveResult?.attempt;
    if (!a) return;
    saveAttempt(a);
    router.push(`/relatorio?athlete=${a.athleteId}&session=${a.sessionId}`);
  }

  function resetAttempt() {
    setFrozen(null); // limpa o snapshot → tela volta ao estado vazio
    setSaveResult(null);
    setAttemptId(null);
    setAttemptNum(0);
  }

  return (
    <>
      <Header
        athleteName={athlete ? `${athlete.nome} (${athlete.categoria})` : undefined}
        isLive={isLive}
        rightSlot={
          <div className="flex items-center gap-2">
            <select
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-border bg-white"
              disabled={isLive}
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} — {a.categoria}
                </option>
              ))}
            </select>
            {!isLive ? (
              <button
                onClick={startAttempt}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-sesi-red-500 text-white hover:bg-sesi-red-600 transition shadow-sm shadow-sesi-red-500/30"
              >
                <HiOutlinePlay className="w-4 h-4" /> Iniciar Tentativa
              </button>
            ) : (
              <button
                onClick={stopAttempt}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-sesi-black text-white hover:bg-sesi-charcoal transition"
              >
                <HiOutlineStop className="w-4 h-4" /> Encerrar
              </button>
            )}
            {attemptNum > 0 && !isLive && (
              <button
                onClick={resetAttempt}
                title="Resetar"
                className="p-2 rounded-lg border border-border hover:bg-track-50 transition"
              >
                <HiOutlineArrowPath className="w-4 h-4" />
              </button>
            )}
          </div>
        }
      />

      <motion.div
        variants={containerStagger}
        initial="initial"
        animate="animate"
        className="flex-1 p-6 space-y-5 max-w-[1500px] w-full mx-auto"
      >
        <motion.div variants={itemFade} className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">Análise ao Vivo</h1>
            <DistanceSelector value={distance} onChange={setDistance} disabled={isLive} />
            {attemptNum > 0 && (
              <span className="text-sm text-text-muted">
                Tentativa <span className="font-bold text-text">#{attemptNum}</span>
              </span>
            )}
            <BridgePill
              isFirebaseMode={bridge.isFirebaseMode}
              isOnline={bridge.isOnline}
              statusLabel={bridge.status?.status}
            />
          </div>
        </motion.div>

        {signalLost && (
          <motion.div variants={itemFade}>
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">Sinal perdido — verifique o cabo do ESP32</p>
                <p className="text-xs text-red-700">Os valores abaixo estão congelados no último dado recebido. Tentando reconectar…</p>
              </div>
            </div>
          </motion.div>
        )}
        {calibrating && !signalLost && (
          <motion.div variants={itemFade}>
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              <p className="text-sm text-amber-800">Calibrando o ângulo — mantenha a carretilha <span className="font-bold">parada</span> por um instante.</p>
            </div>
          </motion.div>
        )}
        {saveResult && !attemptId && (
          <motion.div variants={itemFade}>
            <SaveResultBanner result={saveResult} onSaveAndOpen={saveAndOpen} />
          </motion.div>
        )}

        <motion.div variants={itemFade}>
          <Card>
            <PhaseIndicator displacement={current?.displacement ?? 0} target={distance} />
          </Card>
        </motion.div>

        <motion.div variants={itemFade} className={`grid grid-cols-1 lg:grid-cols-4 gap-4 transition-opacity ${signalLost ? "opacity-50" : ""}`}>
          <Chronometer elapsed={current?.elapsed ?? 0} isLive={isLive} />
          <StatCard label="Velocidade" value={current?.velocity ?? 0} unit=" m/s" reference={athlete?.referenciaVelocidade} large icon={<HiOutlineBolt className="w-5 h-5" />} />
          <StatCard label="Deslocamento" value={(current?.displacement ?? 0).toFixed(2)} unit=" m" reference={distance} large icon={<HiOutlineArrowLongRight className="w-5 h-5" />} />
          <StatCard label="Ângulo de Largada" value={launchAngle} unit="°" reference={athlete?.referenciaAngulo} large icon={<HiOutlineCubeTransparent className="w-5 h-5" />} />
        </motion.div>

        <motion.div variants={itemFade}>
          <Card
            title="Velocidade × Deslocamento"
            headerRight={
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">{curve.length} pts</Badge>
                {markers.peakVelTime !== undefined && (
                  <Badge variant="critical" size="sm">vmax @ {markers.peakVelTime.toFixed(2)}s</Badge>
                )}
              </div>
            }
          >
            <DualMetricChart data={chartCurve} reference={athlete?.referenciaVelocidade} peakVelTime={markers.peakVelTime} />
          </Card>
        </motion.div>

        {/* Saída do bloco — velocidade nos 1ºs N_EXIT_POINTS pontos (janela do ajuste_plot_vel.py) */}
        <motion.div variants={itemFade} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            title="Velocidade na Saída do Bloco"
            className="lg:col-span-2"
            headerRight={<Badge variant="primary" size="sm">1ºs {N_EXIT_POINTS} pts</Badge>}
          >
            <ExitVelocityChart points={exitPts} windowM={exitWindowM} showPeak={false} />
          </Card>
          <div className="space-y-3">
            <StatCard
              label={`Vel. média saída (${N_EXIT_POINTS} pts)`}
              value={exitMean}
              unit=" m/s"
              reference={athlete?.referenciaVelocidade}
              large
              icon={<HiOutlineBolt className="w-5 h-5" />}
            />
          </div>
        </motion.div>

        {!attemptId && !frozen && (
          <motion.div variants={itemFade}>
            <Card className="border-dashed text-center bg-white/40">
              <p className="text-sm text-text-muted">
                Selecione um atleta e clique em <span className="font-bold text-sesi-red-500">Iniciar Tentativa</span> para começar a captura ao vivo via ESP32.
              </p>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}

function BridgePill({
  isFirebaseMode,
  isOnline,
  statusLabel,
}: {
  isFirebaseMode: boolean;
  isOnline: boolean;
  statusLabel?: string;
}) {
  if (LIVE_SOURCE === "local-ws") {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
        Local WS · server.py
      </span>
    );
  }
  if (!isFirebaseMode) {
    return null;
  }
  const color = isOnline
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-red-100 text-red-800 border-red-200";
  const dot = isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500";
  const text = isOnline ? `Bridge online${statusLabel ? ` · ${statusLabel}` : ""}` : "Bridge offline";
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

const DISTANCE_PRESETS = [10, 20, 100];

function DistanceSelector({
  value, onChange, disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const isPreset = DISTANCE_PRESETS.includes(value);
  const [custom, setCustom] = useState(isPreset ? "" : String(value));
  useEffect(() => {
    if (isPreset) setCustom("");
  }, [isPreset, value]);

  return (
    <div
      className={`flex items-center gap-1 bg-track-50 rounded-lg p-0.5 ${disabled ? "opacity-60" : ""}`}
      role="group"
      aria-label="Distância da prova"
    >
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold px-1.5">Prova</span>
      {DISTANCE_PRESETS.map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onChange(d)}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
            value === d ? "bg-sesi-red-500 text-white shadow-sm" : "text-text-muted hover:text-text"
          } ${disabled ? "cursor-not-allowed" : ""}`}
        >
          {d}m
        </button>
      ))}
      <input
        type="number"
        min={2}
        max={1000}
        step={1}
        disabled={disabled}
        value={custom}
        placeholder="outra"
        onChange={(e) => {
          const raw = e.target.value;
          setCustom(raw);
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n) && n >= 2 && n <= 1000) onChange(n);
        }}
        className={`w-16 px-2 py-1 text-[11px] rounded-md border tabular-nums ${
          !isPreset ? "border-sesi-red-300 bg-sesi-red-50 font-semibold" : "border-border bg-white"
        } ${disabled ? "cursor-not-allowed" : ""}`}
        aria-label="Distância customizada (m)"
      />
      <span className="text-[10px] text-text-muted pr-1">m</span>
    </div>
  );
}

function SaveResultBanner({
  result, onSaveAndOpen,
}: {
  result: { status: "saved" | "trivial" | "empty"; maxD: number; peak: number; points: number };
  onSaveAndOpen: () => void;
}) {
  if (result.status === "saved") {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Tentativa salva automaticamente ✓</p>
            <p className="text-xs text-emerald-700">
              {result.points} amostras · {result.maxD.toFixed(1)} m · pico {result.peak.toFixed(2)} m/s.
            </p>
          </div>
        </div>
        <button
          onClick={onSaveAndOpen}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm flex-shrink-0"
        >
          Salvar e ver na sessão →
        </button>
      </div>
    );
  }
  if (result.status === "trivial") {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900">Tentativa não salva automaticamente</p>
            <p className="text-xs text-amber-800">
              Só {result.maxD.toFixed(1)} m e pico {result.peak.toFixed(2)} m/s — abaixo do mínimo (2 m / 0,5 m/s) que evita salvar start-stop acidental. Salve à mão se foi uma corrida válida.
            </p>
          </div>
        </div>
        <button
          onClick={onSaveAndOpen}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-sesi-red-500 text-white hover:bg-sesi-red-600 transition shadow-sm shadow-sesi-red-500/30 flex-shrink-0"
        >
          Salvar e ver na sessão →
        </button>
      </div>
    );
  }
  // empty: nenhuma amostra chegou da ESP
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3">
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
      <div>
        <p className="text-sm font-bold text-red-800">Nenhum dado recebido da ESP — nada para salvar</p>
        <p className="text-xs text-red-700">
          A captura recebeu {result.points} amostra(s). Confira a conexão (painel de hardware e a serial COM5) antes de repetir a tentativa.
        </p>
      </div>
    </div>
  );
}

