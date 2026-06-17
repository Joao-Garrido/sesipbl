"use client";
// REQ-13 v2: Tela tempo real completa — raw + processado + hardware + splits + chronometer
import { useEffect, useMemo, useRef, useState } from "react";
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
import { buildPhases, fmtMeters } from "@/lib/phases";
import {
  bodyAngleCurve,
  exitPeakVelocity,
  exitVelocityMean,
  exitPhasePoints,
  exitWindowMeters,
  launchAnglePeak,
} from "@/lib/analysis";
import type { Attempt, AttemptMetrics, LiveFrame, VelocityPoint } from "@/lib/types";
import { Card } from "@/shared/components/Card";
import { StatCard } from "@/shared/components/StatCard";
import { Header } from "@/shared/components/Header";
import { Badge } from "@/shared/components/Badge";
import { Chronometer } from "./Chronometer";
import { HardwarePanel } from "./HardwarePanel";
import { RawStreamTicker } from "./RawStreamTicker";
import { PhaseIndicator } from "./PhaseIndicator";
import { SplitsTable } from "./SplitsTable";
import { DualMetricChart } from "./DualMetricChart";
import { ExitVelocityChart } from "@/features/analysis/ExitVelocityChart";
import { BodyAngleChart } from "@/features/analysis/BodyAngleChart";

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
  const { athletes } = useAthletes();
  const [athleteId, setAthleteId] = useState<string>("atl-teste");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptNum, setAttemptNum] = useState(0);
  const [distance, setDistance] = useState(100); // distância-alvo da prova (m)
  const startedAtRef = useRef<number>(0);
  // Amostras de Angulo_graus da tentativa → ângulo de largada ÚNICO via find_peaks
  // (reproduz angulo_fio.py). Valor congela no pico encontrado, não muda ao vivo.
  const angleSamplesRef = useRef<number[]>([]);
  const [launchAngle, setLaunchAngle] = useState(0);

  const athlete = athletes.find((a) => a.id === athleteId);
  const { isLive, current: liveCurrent, curve: liveCurve, rawHistory: liveRaw, hardware, calibrating } = useAutoLiveSession(attemptId, athleteId);
  const bridge = useBridgeStatus();

  // Congela a última tentativa: ao encerrar, o hook zera o stream (attemptId=null).
  // Guardamos um snapshot para o treinador revisar até iniciar outra ou clicar em limpar.
  const [frozen, setFrozen] = useState<{
    current: LiveFrame | null;
    curve: VelocityPoint[];
    rawHistory: LiveFrame[];
  } | null>(null);

  // Valores exibidos: snapshot congelado tem prioridade sobre o stream vivo (vazio pós-stop).
  const current = frozen ? frozen.current : liveCurrent;
  const curve = frozen ? frozen.curve : liveCurve;
  const rawHistory = frozen ? frozen.rawHistory : liveRaw;

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

  // Fases dependem da distância (ver lib/phases): provas longas (>=60m) usam fases
  // físicas nomeadas; provas curtas (<60m) viram trechos iguais SEM nome.
  const phases = useMemo(() => {
    const firstTimeAt = (m: number): number | null => {
      const p = curve.find((pt) => (pt.d ?? 0) >= m);
      return p ? p.t : null;
    };
    const avgVelBetween = (d0: number, d1: number): number => {
      const pts = curve.filter((p) => (p.d ?? 0) >= d0 && (p.d ?? 0) < d1);
      return pts.length ? pts.reduce((s, p) => s + p.v, 0) / pts.length : 0;
    };
    return buildPhases(distance).map((d) => {
      const tA = d.lo === 0 ? 0 : firstTimeAt(d.lo);
      const tB = firstTimeAt(d.hi);
      return {
        label: d.label,
        range: `${fmtMeters(d.lo)}–${fmtMeters(d.hi)}m`,
        endM: d.hi,
        vel: avgVelBetween(d.lo, d.hi),
        t: tA != null && tB != null ? tB - tA : null,
      };
    });
  }, [curve, distance]);

  // Curva amostrada (≤800 pts) só para os gráficos — mantém o render leve. A curva
  // completa (`curve`) segue intacta para métricas e salvamento.
  const chartCurve = useMemo(() => downsampleCurve(curve, 800), [curve]);

  // Saída do bloco (primeiros 10% da prova) — a fase mais importante. Pontos da fase
  // p/ o gráfico (curva amostrada) e o pico de velocidade (da curva completa, exato).
  const exitWindow = useMemo(() => exitWindowMeters(distance), [distance]);
  const exitPts = useMemo(() => exitPhasePoints(chartCurve, distance), [chartCurve, distance]);
  const exitPeak = useMemo(() => exitPeakVelocity(curve, distance), [curve, distance]);
  // Vel. média dos primeiros 200 pontos coletados (reproduz ajuste_plot_vel.py: N_INICIO=200)
  const exitMean = useMemo(() => exitVelocityMean(curve), [curve]);

  // Curva do ângulo do corpo (modelo de inclinação por aceleração — ver lib/analysis).
  const bodyAngle = useMemo(() => bodyAngleCurve(chartCurve), [chartCurve]);
  const currentBodyAngle = bodyAngle.length ? bodyAngle[bodyAngle.length - 1].angle : 90;

  // Ângulo de largada = valor ÚNICO obtido por find_peaks sobre o sinal de
  // Angulo_graus da tentativa (pico de maior amplitude — ver angulo_fio.py).
  // Acumula as amostras e recalcula o pico; o valor congela quando achado.
  useEffect(() => {
    if (!attemptId || !current || !Number.isFinite(current.angle)) return;
    angleSamplesRef.current.push(current.angle);
    setLaunchAngle(launchAnglePeak(angleSamplesRef.current));
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
    angleSamplesRef.current = [];
    setLaunchAngle(0);
    setFrozen(null); // descongela: nova tentativa volta ao stream vivo
    setAttemptNum((n) => n + 1);
    setAttemptId(newAttemptId);
  }

  // Monta e salva a tentativa concluída (métricas + curva) no store local.
  // Idempotente: auto-stop e "Encerrar" podem chamar para o mesmo attemptId.
  function persistAttempt() {
    if (IS_DEMO) return; // modo demo: o stream é simulado, não salva como tentativa real
    // `curve` vem do hook a TAXA PLENA e cobre o run inteiro (splits sem perda de amostra).
    const full = curve;
    if (!attemptId || full.length < 5) return;
    const maxDispRaw = full[full.length - 1]?.d ?? current?.displacement ?? 0;
    const peakVelocity = full.reduce((m, p) => (p.v > m ? p.v : m), 0);
    // ignora tentativas triviais: start/stop acidental ou giro quase parado
    if (maxDispRaw < 2 || peakVelocity < 0.5) return;

    const reachedTarget = maxDispRaw >= distance;
    const sessionId = todaySessionId(athleteId);
    const existing = getAttemptsBySession(sessionId);
    const prior = existing.find((a) => a.id === attemptId);
    const numero = prior ? prior.numero : existing.length + 1;
    // ângulo de largada: valor ÚNICO via find_peaks (pico de maior amplitude — angulo_fio.py)
    const startAngle = +launchAngle.toFixed(1);
    const firstTimeAt = (m: number) => full.find((p) => (p.d ?? 0) >= m)?.t;

    const metrics: AttemptMetrics = {
      peakVelocity: +peakVelocity.toFixed(2),
      startAngle,
      exitPeakVelocity: +exitPeakVelocity(full, distance).toFixed(2), // pico nos 1ºs 10%
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
      velocityCurve: downsampleCurve(full, 300),
      // saída do bloco em alta densidade (≤200 pts só dos 1ºs 10%): a fase mais
      // importante não perde amostras como na velocityCurve (reduzida p/ a prova toda).
      exitCurve: downsampleCurve(exitPhasePoints(full, distance), 200),
      startedAt: startedAtRef.current || Date.now(),
      finishedAt: Date.now(),
    };
    saveAttempt(attempt);
  }

  async function stopAttempt() {
    persistAttempt(); // salva ANTES de limpar o stream (setAttemptId(null) zera a curva)
    // congela os valores vivos para o treinador revisar (sobrevive ao setAttemptId(null))
    setFrozen({ current: liveCurrent, curve: liveCurve, rawHistory: liveRaw });
    setAttemptId(null);
    try {
      await stopAttemptControl();
    } catch (err) {
      console.error("stopAttemptControl falhou:", err);
    }
  }
  function resetAttempt() {
    setFrozen(null); // limpa o snapshot → tela volta ao estado vazio
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
          <HardwarePanel hw={hardware} />
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

        {/* Saída do bloco (primeiros 10%) — velocidade instantânea da fase + pico */}
        <motion.div variants={itemFade} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            title="Velocidade na Saída do Bloco"
            className="lg:col-span-2"
            headerRight={
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">1ºs 10% · {fmtMeters(exitWindow)}m</Badge>
                {exitPeak > 0 && <Badge variant="critical" size="sm">pico {exitPeak.toFixed(2)} m/s</Badge>}
              </div>
            }
          >
            <ExitVelocityChart points={exitPts} windowM={exitWindow} />
            <p className="text-[11px] text-text-muted mt-2">
              Velocidade instantânea nos primeiros 10% da prova ({fmtMeters(exitWindow)} m) — a fase de saída do bloco, a mais importante para a arrancada.
            </p>
          </Card>
          <div className="space-y-3">
            <StatCard
              label="Vel. média saída (200 pts)"
              value={exitMean}
              unit=" m/s"
              reference={athlete?.referenciaVelocidade}
              large
              icon={<HiOutlineBolt className="w-5 h-5" />}
            />
            <StatCard
              label="Pico de saída (1ºs 10%)"
              value={exitPeak}
              unit=" m/s"
              reference={athlete?.referenciaVelocidade}
              icon={<HiOutlineBolt className="w-5 h-5" />}
            />
          </div>
        </motion.div>

        {/* Ângulo do corpo ao longo da corrida (modelo de inclinação por aceleração) */}
        <motion.div variants={itemFade}>
          <Card
            title="Ângulo do Corpo durante a corrida"
            headerRight={<Badge variant="primary" size="sm">ao vivo {currentBodyAngle.toFixed(0)}°</Badge>}
          >
            <BodyAngleChart points={bodyAngle} />
            <p className="text-[11px] text-text-muted mt-2">
              Modelo biomecânico de inclinação por aceleração: <span className="font-semibold">90° = corpo ereto</span>. Começa acima de 90° na saída (tronco inclinado, aceleração alta) e converge para 90° quando a velocidade estabiliza.
            </p>
          </Card>
        </motion.div>

        {/* Metricas por fase — velocidade media em cada faixa */}
        <motion.div variants={itemFade}>
          <Card title="Métricas por Fase" headerRight={<Badge variant="primary" size="sm">0–{distance}m</Badge>}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {phases.map((p) => (
                <PhaseStat
                  key={p.range}
                  label={p.label}
                  range={p.range}
                  vel={p.vel}
                  t={p.t}
                  done={(current?.displacement ?? 0) >= p.endM}
                />
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-3">
              Vel média em cada faixa de distância. Tentativa encerra automaticamente em {distance}m.
            </p>
          </Card>
        </motion.div>

        <motion.div variants={itemFade} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card title="Stream RAW · ESP32" noPadding>
              <div className="p-3">
                <RawStreamTicker frames={rawHistory} />
              </div>
            </Card>
          </div>
          <Card title="Parciais" headerRight={<span className="text-xs text-text-muted font-mono-num tabular-nums">{(current?.displacement ?? 0).toFixed(1)}m</span>}>
            <SplitsTable curve={curve} displacement={current?.displacement ?? 0} target={distance} />
          </Card>
        </motion.div>

        <motion.div variants={itemFade} className="grid grid-cols-3 gap-3">
          <MicroStat label="Pulsos encoder" value={current?.encoderPulses ?? 0} unit="" mono />
          <MicroStat label="Rotações" value={(current?.encoderRpm ?? 0).toFixed(0)} unit=" rpm" />
          <MicroStat label="Deslocamento" value={(current?.displacement ?? 0).toFixed(2)} unit=" m" />
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

function PhaseStat({
  label, range, vel, t, done,
}: {
  label: string;
  range: string;
  vel: number;
  t: number | null;
  done: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1 ${done ? "bg-sesi-red-50 border-sesi-red-100" : "bg-white border-border"}`}>
      <div className="flex items-center justify-between">
        {/* Provas curtas não têm nome de fase → mostra a faixa como título */}
        <span className="text-[11px] uppercase tracking-widest text-text-muted font-bold">{label || range}</span>
        {label ? <span className="text-[10px] text-text-muted font-mono-num">{range}</span> : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums">
          {vel > 0 ? vel.toFixed(2) : "—"}
        </span>
        {vel > 0 && <span className="text-xs text-text-muted">m/s</span>}
      </div>
      <span className="text-[11px] text-text-muted tabular-nums">
        {t != null ? `${t.toFixed(2)}s` : "—"}
      </span>
    </div>
  );
}

function MicroStat({ label, value, unit, mono = false }: { label: string; value: string | number; unit: string; mono?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-border px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${mono ? "font-mono-num" : ""}`}>
        {value}
        <span className="text-xs text-text-muted font-normal">{unit}</span>
      </span>
    </div>
  );
}
