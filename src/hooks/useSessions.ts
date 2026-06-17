"use client";
// Sessões de treino — derivadas das tentativas salvas localmente.
// Passe um athleteId para filtrar; sem argumento retorna todas. Reativo.
import { useEffect, useState } from "react";
import * as store from "@/lib/localStore";
import type { Session } from "@/lib/types";

export function useSessions(athleteId?: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const load = () =>
      setSessions(athleteId ? store.getSessionsByAthlete(athleteId) : store.getSessions());
    load();
    return store.subscribe(load);
  }, [athleteId]);

  return sessions;
}
