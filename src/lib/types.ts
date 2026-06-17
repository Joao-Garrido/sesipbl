// Domain types — sistema de análise cinemática

export interface Athlete {
  id: string;
  nome: string;
  categoria: string; // ex: "T11", "T44"
  numeroAtleta?: string;
  referenciaAngulo: number; // ângulo padrão de saída (°)
  referenciaVelocidade?: number; // m/s média histórica
  fotoUrl?: string;
}

export interface VelocityPoint {
  t: number; // tempo desde largada (s)
  v: number; // velocidade escalar |V| (m/s)
  a?: number; // aceleração (m/s²)
  d?: number; // deslocamento (m)
  vx?: number; // componente horizontal (m/s) — direção da pista
  vy?: number; // componente vertical (m/s) — bounce do passo
}

// Amostra CRUA da ESP — exatamente as 5 colunas que o firmware (hardware_final.ino)
// envia pela serial, sem reprocessamento. É o que se exporta no CSV "bruto" literal.
export interface EspRawSample {
  time: number; // millis() da ESP (ms)
  Ax: number; // aceleração eixo X (g)
  Angulo_graus: number; // ângulo já calculado no firmware (asin(ax)*180/PI)
  Pulsos: number; // contagem acumulada do encoder
  Vel_ms: number; // velocidade (m/s) calculada no firmware
}

export interface AttemptMetrics {
  peakVelocity: number;
  startAngle: number; // ângulo da largada (°)
  exitPeakVelocity?: number; // pico de velocidade nos primeiros 10% (saída do bloco, m/s)
  exitMeanVelocity?: number; // vel. média de saída = média dos 1ºs 200 pts (ajuste_plot_vel.py)
  t10m?: number; // tempo até 10m (undefined se não cruzou 10m)
  t30m?: number;
  t100m?: number;
  tFinal?: number; // tempo até a distância-alvo da prova (10/20/100/custom)
}

export interface Attempt {
  id: string;
  sessionId: string;
  athleteId: string;
  numero: number;
  status: "ao-vivo" | "completa" | "parcial" | "invalida";
  distance?: number; // distância-alvo da prova em metros (default 100 p/ dados antigos)
  metrics: AttemptMetrics;
  velocityCurve: VelocityPoint[];
  // Curva da SAÍDA DO BLOCO (primeiros 10% da prova) em alta densidade. A fase mais
  // importante é guardada à parte da velocityCurve (que cobre a prova inteira já
  // reduzida) para não perder amostras dos 10% iniciais. Ausente em dados antigos.
  exitCurve?: VelocityPoint[];
  // Stream CRU da ESP à taxa plena, exatamente como recebido (time,Ax,Angulo_graus,
  // Pulsos,Vel_ms), para exportar o CSV bruto literal. Ausente em dados antigos/demo.
  rawSamples?: EspRawSample[];
  startedAt: number;
  finishedAt?: number;
  notes?: string;
}

export interface Session {
  id: string;
  athleteId: string;
  data: string; // ISO date
  local?: string;
  attempts: Attempt[];
  coachNotes?: string;
}

export type PerformanceLevel = "optimal" | "good" | "warning" | "critical";

export interface LiveFrame {
  // Stream do ESP32 → Realtime DB
  athleteId: string;
  attemptId: string;
  ts: number; // timestamp ms
  velocity: number; // magnitude |V| (m/s)
  vx: number; // componente horizontal (m/s)
  vy: number; // componente vertical (m/s — bounce)
  acceleration: number;
  angle: number;
  displacement: number;
  elapsed: number; // s desde largada
  // RAW data layer
  encoderPulses: number; // pulsos acumulados desde largada
  encoderRpm: number; // rotações por minuto
  imuQuat: [number, number, number, number]; // quaternion w,x,y,z
  imuGyro: [number, number, number]; // °/s — x,y,z
  imuAccel: [number, number, number]; // m/s² — x,y,z (acel linear corpo)
  cadence: number; // passos/min estimado
  signalRssi: number; // dBm Wi-Fi
  battery: number; // 0-100 %
  cpuTempC: number; // °C ESP32
}

export interface HardwareStatus {
  encoder: "ok" | "warn" | "fail";
  imu: "ok" | "warn" | "fail";
  esp32: "ok" | "warn" | "fail";
  rssi: number;
  battery: number;
  latencyMs: number;
}

export interface PhaseSplit {
  phase: "block" | "accel" | "maxv" | "maint";
  label: string;
  range: [number, number]; // metros
  splitTime?: number; // s
  avgVelocity?: number;
  active: boolean;
  done: boolean;
}
