"use client";
// Status do bridge Python (online/offline + estado atual).
// Considera o bridge offline se o último heartbeat tem >30s — re-avalia a cada 5s
// porque o RTDB só dispara evento quando o valor muda, não quando expira.

import { useEffect, useState } from "react";
import { subscribeBridgeStatus, type BridgeStatus } from "@/lib/liveControl";

const STALE_HEARTBEAT_MS = 30_000;
const RECHECK_INTERVAL_MS = 5_000;

export function useBridgeStatus(): {
  status: BridgeStatus | null;
  isOnline: boolean;
  isFirebaseMode: boolean;
} {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeBridgeStatus(setStatus);
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const isOnline =
    !!status &&
    status.status !== "offline" &&
    Date.now() - status.ts < STALE_HEARTBEAT_MS;

  return { status, isOnline, isFirebaseMode: false };
}
