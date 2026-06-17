"use client";
// Tentativas de uma sessão — persistência LOCAL (localStorage via localStore).
// Substitui a query do Firestore. Reativo: ao salvar uma tentativa nova no
// /live, o relatório aberto nesta sessão se atualiza sozinho.
import { useEffect, useState } from "react";
import * as store from "@/lib/localStore";
import type { Attempt } from "@/lib/types";

export function useAttempts(sessionId: string | null) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setAttempts([]);
      setLoading(false);
      return;
    }
    const load = () => setAttempts(store.getAttemptsBySession(sessionId));
    load();
    setLoading(false);
    return store.subscribe(load);
  }, [sessionId]);

  return { attempts, loading };
}
