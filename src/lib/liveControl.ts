// Controle do bridge — site dispara início/fim de tentativa via RTDB.
// O bridge Python escuta /control/active e começa/para o stream pro /live/{attemptId}.

import { onValue, ref, remove, set } from "firebase/database";
import { rtdb, isFirebaseConfigured } from "@/lib/firebase";

export interface AttemptControl {
  attemptId: string;
  athleteId: string;
  sessionId: string;
  status: "active" | "finished";
  startedAt: number;
}

export interface BridgeStatus {
  status: "idle" | "streaming" | "saving" | "offline" | string;
  ts: number;
}

/** Gera um sessionId baseado na data (YYYYMMDD) para agrupar tentativas do dia. */
export function todaySessionId(athleteId: string): string {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `sess-${athleteId}-${yyyymmdd}`;
}

export async function startAttemptControl(
  attemptId: string,
  athleteId: string,
  sessionId?: string
): Promise<void> {
  if (!isFirebaseConfigured || !rtdb) return; // Mock mode: nada a fazer
  const payload: AttemptControl = {
    attemptId,
    athleteId,
    sessionId: sessionId ?? todaySessionId(athleteId),
    status: "active",
    startedAt: Date.now(),
  };
  await set(ref(rtdb, "control/active"), payload);
}

export async function stopAttemptControl(): Promise<void> {
  if (!isFirebaseConfigured || !rtdb) return;
  // Bridge interpreta delete (null) como "finalize and save"
  await remove(ref(rtdb, "control/active"));
}

/** Escuta o status reportado pelo bridge (idle | streaming | saving | offline). */
export function subscribeBridgeStatus(cb: (s: BridgeStatus | null) => void): () => void {
  if (!isFirebaseConfigured || !rtdb) {
    cb({ status: "offline", ts: Date.now() });
    return () => {};
  }
  const r = ref(rtdb, "control/bridge_status");
  const unsub = onValue(r, (snap) => {
    const val = snap.val();
    cb(val as BridgeStatus | null);
  });
  return () => unsub();
}
