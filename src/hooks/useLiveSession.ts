"use client";
// Hook mock — gera corrida sintética; emite dados processados + raw layer
import { useEffect, useRef, useState } from "react";
import type { LiveFrame, VelocityPoint, HardwareStatus } from "@/lib/types";

interface LiveState {
  isLive: boolean;
  current: LiveFrame | null;
  curve: VelocityPoint[];
  rawHistory: LiveFrame[];
  hardware: HardwareStatus;
  calibrating: boolean;
}

const ENCODER_WHEEL_PERIM_M = 0.5;
const PULSES_PER_REV = 600;

export function useLiveSession(attemptId: string | null): LiveState {
  const [current, setCurrent] = useState<LiveFrame | null>(null);
  const [curve, setCurve] = useState<VelocityPoint[]>([]);
  const [rawHistory, setRawHistory] = useState<LiveFrame[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [hardware, setHardware] = useState<HardwareStatus>({
    encoder: "ok", imu: "ok", esp32: "ok", rssi: -52, battery: 87, latencyMs: 18,
  });
  const pulseAccum = useRef(0);

  useEffect(() => {
    if (!attemptId) {
      setCurrent(null);
      setCurve([]);
      setRawHistory([]);
      setIsLive(false);
      pulseAccum.current = 0;
      return;
    }

    setIsLive(true);
    {
      const t0 = Date.now();
      const peak = 8.2;
      pulseAccum.current = 0;

      const interval = setInterval(() => {
        const elapsed = (Date.now() - t0) / 1000;
        if (elapsed > 13) {
          setIsLive(false);
          clearInterval(interval);
          return;
        }
        const v = peak * (1 - Math.exp(-elapsed * 0.85)) - (elapsed > 6 ? (elapsed - 6) * 0.04 : 0);
        const a = elapsed > 0.05 ? Math.max(0, (peak * 0.85) * Math.exp(-elapsed * 0.85)) : 0;
        const angle = 42 + Math.sin(elapsed * 4) * 1.5;
        const d = peak * elapsed - peak / 0.85 * (1 - Math.exp(-elapsed * 0.85));

        // Decomposição V em componentes Vx (horizontal/eficiência) e Vy (bounce vertical)
        // Modelo: bounce vertical oscila com a cadência (passos/s); amplitude cresce com velocidade
        const cadenceBpm = 160 + v * 8;
        const strideHz = cadenceBpm / 60;
        const vyAmp = Math.min(0.55, 0.25 + v * 0.04); // peak ≈ 0.55 m/s a alta velocidade
        const vy = vyAmp * Math.sin(elapsed * strideHz * 2 * Math.PI);
        // Preserva |V|: vx² + vy² = v²
        const vx = Math.sqrt(Math.max(0, v * v - vy * vy));

        const pulsesThisFrame = (v * 0.1) / ENCODER_WHEEL_PERIM_M * PULSES_PER_REV;
        pulseAccum.current += pulsesThisFrame;
        const rpm = (v / ENCODER_WHEEL_PERIM_M) * 60;

        const angRad = (angle * Math.PI) / 180;
        const quat: [number, number, number, number] = [
          +Math.cos(angRad / 2).toFixed(4),
          0, 0,
          +Math.sin(angRad / 2).toFixed(4),
        ];
        const gyro: [number, number, number] = [
          +(Math.sin(elapsed * 6) * 12).toFixed(2),
          +(Math.cos(elapsed * 5) * 8).toFixed(2),
          +(Math.sin(elapsed * 3) * 4).toFixed(2),
        ];
        const accelXYZ: [number, number, number] = [
          +a.toFixed(3),
          +(Math.sin(elapsed * 9) * 1.4).toFixed(3),
          +(9.81 + Math.cos(elapsed * 7) * 0.3).toFixed(3),
        ];

        const frame: LiveFrame = {
          athleteId: "atl-teste",
          attemptId,
          ts: Date.now(),
          velocity: +v.toFixed(2),
          vx: +vx.toFixed(2),
          vy: +vy.toFixed(2),
          acceleration: +a.toFixed(2),
          angle: +angle.toFixed(1),
          displacement: +Math.max(0, d).toFixed(2),
          elapsed: +elapsed.toFixed(2),
          encoderPulses: Math.round(pulseAccum.current),
          encoderRpm: +rpm.toFixed(1),
          imuQuat: quat,
          imuGyro: gyro,
          imuAccel: accelXYZ,
          cadence: Math.round(160 + v * 8 + Math.sin(elapsed * 2) * 4),
          signalRssi: -52 + Math.round(Math.sin(elapsed * 0.5) * 3),
          battery: Math.max(0, 87 - elapsed * 0.05),
          cpuTempC: +(42 + elapsed * 0.3).toFixed(1),
        };

        setCurrent(frame);
        setCurve((prev) => [...prev, { t: frame.elapsed, v: frame.velocity, a: frame.acceleration, d: frame.displacement, vx: frame.vx, vy: frame.vy }]);
        setRawHistory((prev) => [frame, ...prev].slice(0, 30));
        setHardware({
          encoder: "ok",
          imu: "ok",
          esp32: frame.signalRssi < -75 ? "warn" : "ok",
          rssi: frame.signalRssi,
          battery: Math.round(frame.battery),
          latencyMs: 14 + Math.round(Math.sin(elapsed * 3) * 4),
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [attemptId]);

  return { isLive, current, curve, rawHistory, hardware, calibrating: false };
}
