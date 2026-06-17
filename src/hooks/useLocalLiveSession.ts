"use client";
// Hook que conecta no servidor Python local (server.py) via WebSocket
// e converte o CSV cru da ESP em LiveFrame compativel com o dashboard.
//
// Stream cru (5 colunas, firmware hardware_final.ino):
//   time          -> millis() em ms
//   Ax            -> aceleracao eixo X em g (IMU unica)
//   Angulo_graus  -> angulo JA calculado no firmware (asin(ax)*180/PI)
//   Pulsos        -> contagem acumulada do encoder
//   Vel_ms        -> velocidade em m/s JA calculada no firmware
//
// Derivacoes:
//  - elapsed: (time - t0) / 1000
//  - displacement: DIRETO dos pulsos do encoder (pulsos * metersPerPulse do modo de calibracao)
//  - velocity: Vel_ms do firmware, ajustada pelo modo de calibracao
//  - angle: Angulo_graus direto do firmware (sem fusao de 2 IMUs — agora e 1 IMU)
//  - encoderRpm: delta_pulsos / delta_t * 60 / PPR (PPR * MODO_X4 = 2400)
//  - imuAccel: [Ax, 0, 0] em m/s2 (so o eixo X e medido)
//  - imuGyro/cadence/rssi/battery/cpuTemp: a ESP nao envia -> sentinela 0

import { useEffect, useRef, useState } from "react";
import type {
  LiveFrame,
  VelocityPoint,
  HardwareStatus,
  EspRawSample,
} from "@/lib/types";
import { getCalibration } from "@/lib/calibration";
import { useCalibrationMode } from "@/hooks/useCalibrationMode";

interface LiveState {
  isLive: boolean;
  current: LiveFrame | null;
  curve: VelocityPoint[];
  rawHistory: LiveFrame[];
  hardware: HardwareStatus;
  calibrating: boolean; // mantido por compatibilidade; sempre false (angulo vem pronto)
  // Retorna o stream CRU da ESP da tentativa atual, à taxa plena, exatamente como
  // recebido. É um getter (lê um ref) p/ não re-renderizar com o array inteiro.
  getRawSamples: () => EspRawSample[];
}

interface RawRow {
  time: number;
  Ax: number;
  Angulo_graus: number;
  Pulsos: number;
  Vel_ms: number;
  ts_recv?: number;
}

// Encoder: 600 PPR x 4 (quadratura) = 2400 transicoes/volta (valores do firmware)
const PULSES_PER_REV = 2400;

// ----------------------------------------------------------------------------
// CALIBRACAO — DOIS MODOS, escolhidos PELO TREINADOR na plataforma (Configuracoes).
//
//   "firmware"  -> CONFIA no firmware (diametro 0.068 m). velFactor=1, sem fator extra. (PADRAO)
//   "frontend"  -> CALIBRACAO DE PISTA 0.05 x 1.5 (corri 18 m, sistema marcou 12 -> 1.5x).
//
// A logica pura mora em @/lib/calibration (getCalibration, com testes). Aqui o modo e
// LIDO EM RUNTIME via useCalibrationMode e guardado num ref, para a troca valer na hora
// SEM derrubar/reiniciar uma corrida em andamento (o modo nao entra nas deps do useEffect).
// ----------------------------------------------------------------------------

const G_TO_MS2 = 9.81;
const DEG2RAD = Math.PI / 180;

// Quaternion a partir de pitch/roll (yaw=0) para o display de IMU (AngleGauge).
// Convencao XYZ Tait-Bryan. Aqui roll=0 porque so medimos o eixo X (Angulo_graus).
function quaternionDe(pitch: number, roll: number): [number, number, number, number] {
  const cy = 1, sy = 0; // yaw=0
  const cp = Math.cos(pitch * DEG2RAD * 0.5);
  const sp = Math.sin(pitch * DEG2RAD * 0.5);
  const cr = Math.cos(roll * DEG2RAD * 0.5);
  const sr = Math.sin(roll * DEG2RAD * 0.5);
  const w = cr * cp * cy + sr * sp * sy;
  const x = sr * cp * cy - cr * sp * sy;
  const y = cr * sp * cy + sr * cp * sy;
  const z = cr * cp * sy - sr * sp * cy;
  return [+w.toFixed(4), +x.toFixed(4), +y.toFixed(4), +z.toFixed(4)];
}

// Limite de pontos da curva. A curva e acumulada a TAXA PLENA do stream (~100 Hz),
// nao na taxa do throttle de UI — assim os splits (t10/t30/t60/t100m) e a curva salva
// nao perdem amostras. Quando passa de CURVE_MAX, reduz pela metade.
const CURVE_MAX = 4000;
const RAW_MAX = 30;
// Teto de segurança do stream cru salvo por tentativa (~100 Hz). Uma prova normal
// (auto-stop na distância-alvo) fica MUITO abaixo disso; o cap só evita estourar o
// localStorage numa captura anormalmente longa (encoder nunca atingiu o alvo).
const RAW_SAMPLES_MAX = 60000;

export function useLocalLiveSession(
  attemptId: string | null,
  athleteId: string,
  wsUrl: string,
): LiveState {
  const [current, setCurrent] = useState<LiveFrame | null>(null);
  const [curve, setCurve] = useState<VelocityPoint[]>([]);
  const [rawHistory, setRawHistory] = useState<LiveFrame[]>([]);
  const [isLive, setIsLive] = useState(false);
  // Angulo agora vem PRONTO do firmware -> nao ha calibracao de bias de giroscopio.
  // Mantido em `false` para compatibilidade com quem consome o hook.
  const [calibrating] = useState(false);
  // Curva acumulada a TAXA PLENA (toda linha do stream), nao na taxa do throttle.
  // E a fonte para os splits e para a tentativa salva — full-rate, sem perder amostras.
  const curveRef = useRef<VelocityPoint[]>([]);
  // Stream CRU da ESP da tentativa (toda linha "data" recebida, na ordem de chegada),
  // exatamente como o server.py enviou — sem reprocessamento. Base do CSV bruto literal.
  const rawSamplesRef = useRef<EspRawSample[]>([]);
  // Estado HONESTO: nada de mock. Inicia "fail" ate o stream confirmar.
  // RSSI/battery/cpuTemp ficam em 0 porque a ESP nao envia estes campos.
  // A UI deve renderizar "0" como "—" (HardwarePanel faz isso).
  const [hardware, setHardware] = useState<HardwareStatus>({
    encoder: "fail", imu: "fail", esp32: "fail",
    rssi: 0, battery: 0, latencyMs: 0,
  });

  // estado de integracao (refs pra nao causar re-render)
  const stateRef = useRef({
    t0_ms: 0,
    prevTs_ms: 0,
    prevPulsos: 0,
    initialPulsos: 0,   // pulsos no inicio da tentativa (zera display)
    displacement: 0,
    lastFrameAt: 0,
  });

  // Calibracao escolhida pelo treinador (runtime). Guardada num ref para o
  // processRow ler o valor mais recente sem reiniciar a corrida ao trocar de modo.
  const { mode: calibrationMode } = useCalibrationMode();
  const calRef = useRef(getCalibration(calibrationMode));
  calRef.current = getCalibration(calibrationMode);

  useEffect(() => {
    if (!attemptId) {
      setCurrent(null);
      setCurve([]);
      setRawHistory([]);
      setIsLive(false);
      curveRef.current = [];
      rawSamplesRef.current = [];
      return;
    }

    // reset integracao
    stateRef.current = {
      t0_ms: 0,
      prevTs_ms: 0,
      prevPulsos: 0,
      initialPulsos: 0,
      displacement: 0,
      lastFrameAt: 0,
    };
    curveRef.current = [];
    rawSamplesRef.current = [];

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    function connect() {
      if (!alive) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsLive(true);
      };

      ws.onmessage = (ev) => {
        let msg: { type: string; row?: RawRow; data?: RawRow[] };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (msg.type === "data" && msg.row) {
          // Captura a linha CRUA literal (antes de qualquer integração/calibração),
          // exatamente como o server.py a enviou — é o que vai no CSV bruto.
          const r = msg.row;
          if (Number.isFinite(r.time) && rawSamplesRef.current.length < RAW_SAMPLES_MAX) {
            rawSamplesRef.current.push({
              time: r.time,
              Ax: r.Ax,
              Angulo_graus: r.Angulo_graus,
              Pulsos: r.Pulsos,
              Vel_ms: r.Vel_ms,
            });
          }
          processRow(r);
        }
        // 'init' (histórico bufferado do server) é IGNORADO de propósito: é backfill,
        // não dado ao vivo. Processá-lo semearia t0/initialPulsos com uma amostra velha
        // (em reconexão isso daria um salto enorme de deslocamento e encerraria o run).
        // A integração começa do 1º frame "data" real.
      };

      ws.onclose = () => {
        setIsLive(false);
        if (alive) reconnectTimer = setTimeout(connect, 1500);
      };

      ws.onerror = () => {
        try { ws?.close(); } catch { /* noop */ }
      };
    }

    let lastUiUpdate = 0; // throttle das atualizações de React (~25 Hz)
    function processRow(row: RawRow) {
      const s = stateRef.current;
      const nowMs = row.ts_recv ?? Date.now();

      const firstFrame = s.t0_ms === 0;
      if (firstFrame) {
        s.t0_ms = row.time;
        s.prevTs_ms = row.time;
        s.prevPulsos = row.Pulsos;
        s.initialPulsos = row.Pulsos; // zera contador de pulsos da sessao
      }

      // Ignora linhas fora de ordem / repetidas (jitter, reconexão, backfill): um
      // dt<=0 corromperia o RPM e o salto de deslocamento.
      if (!firstFrame && row.time <= s.prevTs_ms) return;

      const dt_ms = Math.max(1, row.time - s.prevTs_ms);
      const dt_s = dt_ms / 1000;
      const elapsed = (row.time - s.t0_ms) / 1000;

      // Aceleracao e a decomposicao Vx/Vy nao fazem parte do algoritmo correto
      // (analise_completaPBL.py): ficam zeradas.
      const acceleration = 0;
      const vx = 0;
      const vy = 0;

      // DESLOCAMENTO direto dos pulsos do encoder (medida primaria — exata, sem o
      // erro de integrar a velocidade). metersPerPulse depende do modo de calibracao.
      s.displacement = (row.Pulsos - s.initialPulsos) * calRef.current.metersPerPulse;
      // Exibido/salvo nunca negativo (giro pra trás no teste manual zera, não vira -X m).
      const disp = Math.max(0, s.displacement);
      // Velocidade do firmware, ajustada pelo modo de calibracao (velFactor=1 no modo firmware).
      const velCal = row.Vel_ms * calRef.current.velFactor;

      // RPM do encoder
      const dPulsos = row.Pulsos - s.prevPulsos;
      const encoderRpm = (dPulsos / PULSES_PER_REV) * (60 / dt_s);

      // ANGULO: vem PRONTO do firmware (calcularAngulo = asin(ax)*180/PI). Sempre >= 0.
      const angle = Math.abs(row.Angulo_graus);

      // Quaternion p/ o display de IMU (RawTicker / AngleGauge): pitch = angulo, roll = 0.
      const quatLocal = quaternionDe(angle, 0);

      // IMU convertido: so o eixo X e medido (em "g" -> m/s2). Y/Z e gyro = 0.
      const imuAccel: [number, number, number] = [row.Ax * G_TO_MS2, 0, 0];
      const imuGyro: [number, number, number] = [0, 0, 0];

      const frame: LiveFrame = {
        athleteId,
        attemptId: attemptId!,
        ts: nowMs,
        velocity: +velCal.toFixed(3),
        vx: +vx.toFixed(3),
        vy: +vy.toFixed(3),
        acceleration: +acceleration.toFixed(3),
        angle: +angle.toFixed(1),
        displacement: +disp.toFixed(2),
        elapsed: +elapsed.toFixed(2),
        encoderPulses: row.Pulsos - s.initialPulsos, // delta desde o inicio
        encoderRpm: +encoderRpm.toFixed(1),
        imuQuat: quatLocal,
        imuGyro,
        imuAccel,
        // Campos que a ESP NAO envia: sentinela 0 (UI trata como "—")
        cadence: 0,
        signalRssi: 0,
        battery: 0,
        cpuTempC: 0,
      };

      // atualiza state de integracao
      s.prevTs_ms = row.time;
      s.prevPulsos = row.Pulsos;
      s.lastFrameAt = nowMs;

      // Acumula a curva a TAXA PLENA (toda linha): é o que alimenta os splits e a
      // tentativa salva. Quando passa do teto, reduz pela metade (mantém o run inteiro).
      const cr = curveRef.current;
      cr.push({ t: frame.elapsed, v: frame.velocity, d: frame.displacement });
      if (cr.length > CURVE_MAX) curveRef.current = cr.filter((_, i) => i % 2 === 0);

      // Throttle de UI (~25 Hz): o cálculo roda a 100 Hz, mas o React só atualiza a cada
      // ~40ms — evita travar a tela. A `curve` (state) espelha a curva full-rate em lote,
      // então gráficos e splits não perdem amostras.
      if (nowMs - lastUiUpdate >= 40) {
        lastUiUpdate = nowMs;
        setCurrent(frame);
        setCurve(curveRef.current.slice());
        setRawHistory((prev) => [frame, ...prev].slice(0, RAW_MAX));

        const latency = Date.now() - nowMs;
        // Status real: marca "ok" porque acabou de chegar um frame.
        // O timer abaixo derruba pra "fail" se ficar >2s sem dados.
        setHardware({
          encoder: "ok", imu: "ok", esp32: "ok",
          rssi: 0, battery: 0,
          latencyMs: Math.max(0, latency),
        });
      }
    }

    // Stale detector: se nao chega frame ha >2s, marca hardware como "fail"
    const staleTimer = setInterval(() => {
      const last = stateRef.current.lastFrameAt;
      if (last === 0) return; // ainda nao chegou nada
      if (Date.now() - last > 2000) {
        setHardware((prev) => ({
          ...prev,
          encoder: "fail", imu: "fail", esp32: "fail",
        }));
      }
    }, 1000);

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(staleTimer);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [attemptId, athleteId, wsUrl]);

  return {
    isLive, current, curve, rawHistory, hardware, calibrating,
    getRawSamples: () => rawSamplesRef.current,
  };
}
