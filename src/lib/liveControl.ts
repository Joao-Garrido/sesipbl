// Controle de tentativa — no modo local-only (ESP WebSocket + mock) não há bridge
// remoto. As funções de controle viram no-op e o status reporta sempre offline.
// Assinaturas e tipos mantidos para os callers (LiveDashboard, useBridgeStatus).

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
  _attemptId: string,
  _athleteId: string,
  _sessionId?: string
): Promise<void> {
  // Local-only: sem bridge remoto, nada a disparar.
}

export async function stopAttemptControl(): Promise<void> {
  // Local-only: sem bridge remoto, nada a finalizar.
}

/** No modo local-only não há bridge — reporta sempre offline. */
export function subscribeBridgeStatus(cb: (s: BridgeStatus | null) => void): () => void {
  cb({ status: "offline", ts: Date.now() });
  return () => {};
}
