"use client";
// Hook que conecta no servidor Python local (server.py) via WebSocket
// e converte o CSV cru da ESP em LiveFrame compativel com o dashboard.
//
// Stream cru (15 colunas): ts_device, l_ax/y/z, l_gx/y/z, r_ax/y/z, r_gx/y/z, pulsos, vel
// (l = local/carretilha, r = remoto/atleta via ESP-NOW)
//
// Derivacoes:
//  - elapsed: (ts_device - t0) / 1000
//  - acceleration: derivada da velocidade entre frames
//  - displacement: DIRETO dos pulsos do encoder (voltas * circunferencia) — medida primaria
//  - encoderRpm: delta_pulsos / delta_t * 60 / PPR (PPR * MODO_X4 = 2400)
//  - imuAccel/imuGyro: pega o IMU local (l_*)
//  - vx/vy: decomposicao simples (vy = bounce vertical estimado, vx = sqrt(v^2 - vy^2))
//  - angle, quat, cadence, rssi, battery, cpuTemp: placeholders (sem fusao IMU completa)

import { useEffect, useRef, useState } from "react";
import type {
  LiveFrame,
  VelocityPoint,
  HardwareStatus,
} from "@/lib/types";

interface LiveState {
  isLive: boolean;
  current: LiveFrame | null;
  curve: VelocityPoint[];
  rawHistory: LiveFrame[];
  hardware: HardwareStatus;
  calibrating: boolean; // true enquanto mede o bias do giroscopio (carretilha parada)
}

interface RawRow {
  ts_device: number;
  ts_recv?: number;
  l_ax: number; l_ay: number; l_az: number;
  l_gx: number; l_gy: number; l_gz: number;
  r_ax: number; r_ay: number; r_az: number;
  r_gx: number; r_gy: number; r_gz: number;
  pulsos: number;
  vel: number;
}

// Encoder: 600 PPR x 4 (quadratura) = 2400 transicoes/volta (valores do firmware)
const PULSES_PER_REV = 2400;
// Diametro da carretilha assumido pelo firmware (encoder_esp.cpp / server.py).
const WHEEL_DIAMETER_M = 0.05;
const WHEEL_CIRCUMFERENCE_M = Math.PI * WHEEL_DIAMETER_M;
// CALIBRAÇÃO DE DISTÂNCIA (medida na pista): corri 18 m e o sistema marcou 12 m,
// então o metro-por-pulso real é 18/12 = 1.5x o calculado pelos valores do firmware.
// Causa provável: o encoder é 400 PPR (não 600) OU a roda é maior que 5 cm. Aplicado
// ao DESLOCAMENTO e à VELOCIDADE (ambos derivam do mesmo encoder, então ambos estavam
// 1.5x baixos). Para recalibrar: corra uma distância conhecida e ajuste = real/medido.
const DISTANCE_CALIBRATION = 1.5;
const METERS_PER_PULSE = (WHEEL_CIRCUMFERENCE_M / PULSES_PER_REV) * DISTANCE_CALIBRATION;
const G_TO_MS2 = 9.81;
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

// --- Calculo de angulo entre 2 IMUs (porta de PBL7_Carretilha/angulo_imus.py) ---
// pitch = atan2(ax, sqrt(ay^2 + az^2))
// roll  = atan2(ay, sqrt(ax^2 + az^2))
function calcularEuler(ax: number, ay: number, az: number): { pitch: number; roll: number } {
  const pitch = Math.atan2(ax, Math.sqrt(ay * ay + az * az)) * RAD2DEG;
  const roll  = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * RAD2DEG;
  return { pitch, roll };
}

// Quaternion a partir de pitch/roll (yaw=0). Para AngleGauge / IMU display.
// Usa convencao XYZ Tait-Bryan.
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
// nao perdem 75% das amostras. Quando passa de CURVE_MAX, reduz pela metade
// (mantem a corrida inteira, so com menos densidade) em vez de cortar a largada.
const CURVE_MAX = 4000;
const RAW_MAX = 30;
// Minimo de amostras paradas antes de travar o bias do giroscopio. Se o atleta ja
// estiver em movimento na largada, nao da pra calibrar e o angulo fica menos confiavel.
const BIAS_MIN_SAMPLES = 10;

export function useLocalLiveSession(
  attemptId: string | null,
  athleteId: string,
  wsUrl: string,
): LiveState {
  const [current, setCurrent] = useState<LiveFrame | null>(null);
  const [curve, setCurve] = useState<VelocityPoint[]>([]);
  const [rawHistory, setRawHistory] = useState<LiveFrame[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  // Curva acumulada a TAXA PLENA (toda linha do stream), nao na taxa do throttle.
  // E a fonte para os splits e para a tentativa salva — full-rate, sem perder amostras.
  const curveRef = useRef<VelocityPoint[]>([]);
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
    prevVel: 0,
    prevPulsos: 0,
    initialPulsos: 0,   // pulsos no inicio da tentativa (zera display)
    displacement: 0,
    lastFrameAt: 0,
    prevVelTs: 0,       // ts da ultima mudanca de velocidade (p/ aceleracao correta)
    lastAccel: 0,       // ultima aceleracao (segura entre updates de vel da ESP)
    lastAngle: 0,       // ultimo angulo (saida do filtro passa-baixa)
    velHist: [] as Array<{ t: number; v: number }>, // janela p/ suavizar a aceleracao
    lYaw: 0,            // yaw integrado da IMU local (carretilha)
    rYaw: 0,            // yaw integrado da IMU remota (atleta)
    lastRGy: 0,         // ultimo giroscopio Y valido do atleta (segura quando zera)
    angleInit: false,   // 1o valor do filtro passa-baixa do angulo
    biasL: 0, biasR: 0, // bias (offset) do giroscopio Y, medido parado
    biasSumL: 0, biasSumR: 0, biasN: 0, // acumuladores da calibracao de bias
    biasReady: false,   // bias ja travado?
  });

  useEffect(() => {
    if (!attemptId) {
      setCurrent(null);
      setCurve([]);
      setRawHistory([]);
      setIsLive(false);
      setCalibrating(false);
      curveRef.current = [];
      return;
    }

    // reset integracao
    stateRef.current = {
      t0_ms: 0,
      prevTs_ms: 0,
      prevVel: 0,
      prevPulsos: 0,
      initialPulsos: 0,
      displacement: 0,
      lastFrameAt: 0,
      prevVelTs: 0,
      lastAccel: 0,
      lastAngle: 0,
      velHist: [] as Array<{ t: number; v: number }>,
      lYaw: 0,
      rYaw: 0,
      lastRGy: 0,
      angleInit: false,
      biasL: 0, biasR: 0,
      biasSumL: 0, biasSumR: 0, biasN: 0,
      biasReady: false,
    };
    curveRef.current = [];
    setCalibrating(true); // começa calibrando o bias (carretilha deve estar parada)

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
          processRow(msg.row);
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
        s.t0_ms = row.ts_device;
        s.prevTs_ms = row.ts_device;
        s.prevPulsos = row.pulsos;
        s.initialPulsos = row.pulsos; // zera contador de pulsos da sessao
        s.prevVel = row.vel; // evita spike de aceleracao no 1o frame
        s.prevVelTs = row.ts_device;
      }

      // Ignora linhas fora de ordem / repetidas (jitter, reconexão, backfill): um
      // dt<=0 corromperia a integração do giroscópio, o RPM e o salto de deslocamento.
      if (!firstFrame && row.ts_device <= s.prevTs_ms) return;

      const dt_ms = Math.max(1, row.ts_device - s.prevTs_ms);
      const dt_s = dt_ms / 1000;
      const elapsed = (row.ts_device - s.t0_ms) / 1000;

      // Aceleracao e a decomposicao Vx/Vy foram REMOVIDAS: nao fazem parte do
      // algoritmo correto (analise_completaPBL.py). A aceleracao era a derivada
      // ruidosa da velocidade quantizada (100ms); Vx/Vy era estimativa empirica.
      const acceleration = 0;
      const vx = 0;
      const vy = 0;

      // DESLOCAMENTO direto dos pulsos do encoder (medida primaria — exata, sem o
      // erro de integrar a velocidade). Inclui a calibração de pista (METERS_PER_PULSE).
      s.displacement = (row.pulsos - s.initialPulsos) * METERS_PER_PULSE;
      // Exibido/salvo nunca negativo (giro pra trás no teste manual zera, não vira -X m).
      const disp = Math.max(0, s.displacement);
      // Velocidade da ESP corrigida pela mesma calibração (vinha do mesmo encoder).
      const velCal = row.vel * DISTANCE_CALIBRATION;

      // RPM do encoder
      const dPulsos = row.pulsos - s.prevPulsos;
      const encoderRpm = (dPulsos / PULSES_PER_REV) * (60 / dt_s);

      // ANGULO entre as 2 IMUs — metodo do analise_completaPBL.py + REMOCAO DE BIAS.
      // Enquanto a carretilha esta parada (vel<0.2) no inicio (ate 2s), mede o bias
      // (offset) do giroscopio. Ao comecar a mover, trava o bias e integra
      // (gy - bias) -> yaw. Angulo = |L_Yaw - R_Yaw| com passa-baixa ~2Hz.
      // Subtrair o bias elimina a deriva que o giroscopio acumularia.
      const eL = calcularEuler(row.l_ax, row.l_ay, row.l_az);
      const rZero = row.r_ax === 0 && row.r_ay === 0 && row.r_az === 0;
      const rGy = rZero ? s.lastRGy : row.r_gy; // sem pacote novo do atleta: segura o ultimo
      if (!rZero) s.lastRGy = row.r_gy;

      const lpAlpha = dt_s / (1 / (2 * Math.PI * 2) + dt_s); // passa-baixa 2 Hz
      let angle: number;
      if (!s.biasReady) {
        if (row.vel < 0.2 && elapsed < 2.0) {
          // ainda parado: acumula o bias do giroscopio, angulo fica em 0
          s.biasSumL += row.l_gy;
          s.biasSumR += rGy;
          s.biasN += 1;
          angle = 0;
        } else {
          // comecou a mover (ou passou 2s): trava o bias e comeca a integrar.
          // Só usa o bias medido se houver amostras paradas suficientes; senão integra
          // sem bias (atleta já em movimento na largada = ângulo menos confiável).
          const enough = s.biasN >= BIAS_MIN_SAMPLES;
          s.biasL = enough ? s.biasSumL / s.biasN : 0;
          s.biasR = enough ? s.biasSumR / s.biasN : 0;
          s.biasReady = true;
          s.lYaw += (row.l_gy - s.biasL) * dt_s;
          s.rYaw += (rGy - s.biasR) * dt_s;
          angle = Math.abs(s.lYaw - s.rYaw);
        }
      } else {
        s.lYaw += (row.l_gy - s.biasL) * dt_s;
        s.rYaw += (rGy - s.biasR) * dt_s;
        const angleRaw = Math.abs(s.lYaw - s.rYaw);
        angle = s.lastAngle + lpAlpha * (angleRaw - s.lastAngle);
      }
      s.lastAngle = angle;

      // Quaternion do IMU LOCAL (visual do RawTicker) — independente do angulo
      const quatLocal = quaternionDe(eL.pitch, eL.roll);

      // IMU convertido: CSV em "g" -> m/s2
      const imuAccel: [number, number, number] = [
        row.l_ax * G_TO_MS2,
        row.l_ay * G_TO_MS2,
        row.l_az * G_TO_MS2,
      ];
      const imuGyro: [number, number, number] = [row.l_gx, row.l_gy, row.l_gz];

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
        encoderPulses: row.pulsos - s.initialPulsos, // delta desde o inicio
        encoderRpm: +encoderRpm.toFixed(1),
        // Quaternion: derivado de pitch/roll do IMU local (PBL7_Carretilha logic)
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
      s.prevVel = row.vel;
      s.prevTs_ms = row.ts_device;
      s.prevPulsos = row.pulsos;
      s.lastFrameAt = nowMs;

      // Acumula a curva a TAXA PLENA (toda linha): é o que alimenta os splits e a
      // tentativa salva. Quando passa do teto, reduz pela metade (mantém o run inteiro).
      const cr = curveRef.current;
      cr.push({ t: frame.elapsed, v: frame.velocity, d: frame.displacement });
      if (cr.length > CURVE_MAX) curveRef.current = cr.filter((_, i) => i % 2 === 0);

      // Throttle de UI (~25 Hz): o cálculo/integração roda a 100 Hz, mas o React só
      // atualiza a cada ~40ms — evita travar a tela. A `curve` (state) espelha a curva
      // full-rate em lote, então gráficos e splits não perdem 75% das amostras.
      if (nowMs - lastUiUpdate >= 40) {
        lastUiUpdate = nowMs;
        setCurrent(frame);
        setCurve(curveRef.current.slice());
        setRawHistory((prev) => [frame, ...prev].slice(0, RAW_MAX));
        setCalibrating(!s.biasReady);

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

  return { isLive, current, curve, rawHistory, hardware, calibrating };
}
