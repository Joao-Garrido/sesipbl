"use client";
// Wrapper que escolhe a fonte de dados ao vivo em tempo de build:
//   NEXT_PUBLIC_LOCAL_WS_URL definido  ->  WebSocket local (Python server.py)
//   senao                              ->  Firebase RTDB / mock (comportamento original)
//
// O switch e feito por constante de modulo, entao o hook escolhido nunca muda
// em runtime (compativel com Rules of Hooks).

import { useLiveSession } from "./useLiveSession";
import { useLocalLiveSession } from "./useLocalLiveSession";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { LiveFrame, VelocityPoint, HardwareStatus } from "@/lib/types";

export interface AutoLiveState {
  isLive: boolean;
  current: LiveFrame | null;
  curve: VelocityPoint[];
  rawHistory: LiveFrame[];
  hardware: HardwareStatus;
  calibrating: boolean;
}

const LOCAL_WS_URL: string | undefined = process.env.NEXT_PUBLIC_LOCAL_WS_URL;

// Captura em const com tipo estreito para o TS narrar dentro do callback
const _WS_URL_NARROW: string = LOCAL_WS_URL ?? "";

export const useAutoLiveSession: (
  attemptId: string | null,
  athleteId: string,
) => AutoLiveState = LOCAL_WS_URL
  ? (attemptId, athleteId) =>
      useLocalLiveSession(attemptId, athleteId, _WS_URL_NARROW)
  : (attemptId, _athleteId) => useLiveSession(attemptId);

export const LIVE_SOURCE: "local-ws" | "firebase-or-mock" = LOCAL_WS_URL
  ? "local-ws"
  : "firebase-or-mock";

// Modo demo = sem WS local E sem Firebase: o stream é simulado (useLiveSession gera
// uma corrida sintética). Nesse modo a tentativa NÃO deve ser salva como real.
export const IS_DEMO: boolean = !LOCAL_WS_URL && !isFirebaseConfigured;
