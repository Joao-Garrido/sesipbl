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
//
// CONEXAO PERSISTENTE (gap zero no PLAY): o WebSocket conecta UMA vez e fica aberto,
// independente de ter tentativa ativa. A GRAVACAO (captura para curve/rawSamples) liga
// na 1a amostra recebida APOS o clique do PLAY (attemptId setado). Como o socket ja
// esta aberto, a captura comeca na proxima amostra (~8 ms) — sem o atraso do aperto de
// mao do WebSocket. A janela de saida (1os N pontos) comeca exatamente no clique.

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

const INITIAL_HW: HardwareStatus = {
  encoder: "fail", imu: "fail", esp32: "fail",
  rssi: 0, battery: 0, latencyMs: 0,
};

export function useLocalLiveSession(
  attemptId: string | null,
  athleteId: string,
  wsUrl: string,
): LiveState {
  const [current, setCurrent] = useState<LiveFrame | null>(null);
  const [curve, setCurve] = useState<VelocityPoint[]>([]);
  const [rawHistory, setRawHistory] = useState<LiveFrame[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  // Angulo agora vem PRONTO do firmware -> nao ha calibracao de bias de giroscopio.
  // Mantido em `false` para compatibilidade com quem consome o hook.
  const [calibrating] = useState(false);
  // Estado HONESTO: nada de mock. Inicia "fail" ate o stream confirmar.
  const [hardware, setHardware] = useState<HardwareStatus>(INITIAL_HW);

  // isLive = tem tentativa ativa (PLAY) E o WebSocket está conectado. O botão
  // "Iniciar/Encerrar" e o auto-stop dependem disso.
  const isLive = !!attemptId && wsConnected;

  // Curvas acumuladas a TAXA PLENA (toda linha do stream), nao na taxa do throttle.
  const curveRef = useRef<VelocityPoint[]>([]);
  // Stream CRU da ESP da tentativa (toda linha "data", na ordem de chegada), exatamente
  // como o server.py enviou — sem reprocessamento. Base do CSV bruto e da vel. de saída.
  const rawSamplesRef = useRef<EspRawSample[]>([]);

  // O handler do WebSocket é criado UMA vez (conexão persistente) e não é recriado a
  // cada tentativa, então lê attemptId/athleteId via ref (valor sempre atual).
  const attemptIdRef = useRef(attemptId);
  attemptIdRef.current = attemptId;
  const athleteIdRef = useRef(athleteId);
  athleteIdRef.current = athleteId;
  // attemptId já "armado" no buffer atual — detecta a 1ª amostra de uma NOVA tentativa
  // (instante do PLAY) para zerar o estado bem ali, sem depender de efeito (gap zero).
  const recordingAttemptRef = useRef<string | null>(null);
  const lastUiUpdateRef = useRef(0);

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

  // Ao ENCERRAR (attemptId -> null): limpa o stream vivo (o snapshot "frozen" no
  // LiveDashboard preserva a revisão). O reset do INÍCIO NÃO é feito aqui — é feito no
  // handler do WebSocket, na 1ª amostra após o PLAY, para começar exatamente no clique.
  useEffect(() => {
    if (attemptId) return;
    setCurrent(null);
    setCurve([]);
    setRawHistory([]);
    curveRef.current = [];
    rawSamplesRef.current = [];
    recordingAttemptRef.current = null;
    setHardware(INITIAL_HW);
  }, [attemptId]);

  // WebSocket PERSISTENTE: conecta uma vez (depende só de wsUrl) e fica aberto, com
  // reconexão automática. Assim, quando o PLAY é clicado, a captura começa na PRÓXIMA
  // amostra (~8 ms) — sem o atraso do aperto de mão por tentativa.
  useEffect(() => {
    if (!wsUrl) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    function processRow(row: RawRow) {
      const s = stateRef.current;
      const nowMs = row.ts_recv ?? Date.now();

      const firstFrame = s.t0_ms === 0;
      if (firstFrame) {
        s.t0_ms = row.time;
        s.prevTs_ms = row.time;
        s.prevPulsos = row.Pulsos;
        s.initialPulsos = row.Pulsos; // zera contador de pulsos da tentativa
      }

      // Ignora linhas fora de ordem / repetidas (jitter, reconexão): dt<=0 corromperia
      // o RPM e o salto de deslocamento.
      if (!firstFrame && row.time <= s.prevTs_ms) return;

      const dt_ms = Math.max(1, row.time - s.prevTs_ms);
      const dt_s = dt_ms / 1000;
      const elapsed = (row.time - s.t0_ms) / 1000;

      // Aceleracao e a decomposicao Vx/Vy nao fazem parte do algoritmo correto: zeradas.
      const acceleration = 0;
      const vx = 0;
      const vy = 0;

      // DESLOCAMENTO direto dos pulsos do encoder (medida primaria, exata).
      s.displacement = (row.Pulsos - s.initialPulsos) * calRef.current.metersPerPulse;
      const disp = Math.max(0, s.displacement); // nunca negativo no display
      // Velocidade do firmware, ajustada pela calibracao (velFactor=1 no modo firmware).
      const velCal = row.Vel_ms * calRef.current.velFactor;

      const dPulsos = row.Pulsos - s.prevPulsos;
      const encoderRpm = (dPulsos / PULSES_PER_REV) * (60 / dt_s);

      // ANGULO: vem PRONTO do firmware. Quaternion p/ o display de IMU (pitch=angulo).
      const angle = Math.abs(row.Angulo_graus);
      const quatLocal = quaternionDe(angle, 0);
      const imuAccel: [number, number, number] = [row.Ax * G_TO_MS2, 0, 0];
      const imuGyro: [number, number, number] = [0, 0, 0];

      const frame: LiveFrame = {
        athleteId: athleteIdRef.current,
        attemptId: attemptIdRef.current!,
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
        cadence: 0,
        signalRssi: 0,
        battery: 0,
        cpuTempC: 0,
      };

      s.prevTs_ms = row.time;
      s.prevPulsos = row.Pulsos;
      s.lastFrameAt = nowMs;

      // Acumula a curva a TAXA PLENA. Quando passa do teto, reduz pela metade.
      const cr = curveRef.current;
      cr.push({ t: frame.elapsed, v: frame.velocity, d: frame.displacement });
      if (cr.length > CURVE_MAX) curveRef.current = cr.filter((_, i) => i % 2 === 0);

      // Throttle de UI (~25 Hz): o cálculo roda a ~125 Hz, mas o React só atualiza a cada
      // ~40ms. A curva full-rate e o rawSamples NÃO perdem amostras (acumulam toda linha).
      if (nowMs - lastUiUpdateRef.current >= 40) {
        lastUiUpdateRef.current = nowMs;
        setCurrent(frame);
        setCurve(curveRef.current.slice());
        setRawHistory((prev) => [frame, ...prev].slice(0, RAW_MAX));
        const latency = Date.now() - nowMs;
        setHardware({
          encoder: "ok", imu: "ok", esp32: "ok",
          rssi: 0, battery: 0,
          latencyMs: Math.max(0, latency),
        });
      }
    }

    function connect() {
      if (!alive) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (ev) => {
        let msg: { type: string; row?: RawRow; data?: RawRow[] };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        // 'init' (histórico bufferado do server, anterior ao PLAY) é IGNORADO.
        if (msg.type !== "data" || !msg.row) return;

        const aid = attemptIdRef.current;
        if (!aid) {
          // Sem PLAY ativo: socket fica aberto recebendo, mas NÃO grava nada.
          recordingAttemptRef.current = null;
          return;
        }
        // 1ª amostra desta tentativa = instante do clique no PLAY → zera o estado AQUI,
        // sem esperar nada (gap zero entre o clique e a 1ª amostra capturada).
        if (recordingAttemptRef.current !== aid) {
          recordingAttemptRef.current = aid;
          stateRef.current = {
            t0_ms: 0, prevTs_ms: 0, prevPulsos: 0, initialPulsos: 0, displacement: 0, lastFrameAt: 0,
          };
          curveRef.current = [];
          rawSamplesRef.current = [];
          lastUiUpdateRef.current = 0;
        }

        // Captura a linha CRUA literal (antes de qualquer integração/calibração).
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
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (alive) reconnectTimer = setTimeout(connect, 1500);
      };

      ws.onerror = () => {
        try { ws?.close(); } catch { /* noop */ }
      };
    }

    // Stale detector: durante a captura, se nao chega frame ha >2s, marca hardware "fail".
    const staleTimer = setInterval(() => {
      if (!attemptIdRef.current) return; // só monitora durante uma tentativa
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
  }, [wsUrl]);

  return {
    isLive, current, curve, rawHistory, hardware, calibrating,
    getRawSamples: () => rawSamplesRef.current,
  };
}
