"use client";
// Atletas — persistência LOCAL (localStorage via localStore).
// Substitui a leitura do Firestore. Expõe CRUD; a lista é reativa a mudanças
// no store (criar/editar/excluir atualiza todos os consumidores na hora).
import { useCallback, useEffect, useState } from "react";
import * as store from "@/lib/localStore";
import type { Athlete } from "@/lib/types";

export function useAthletes() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAthletes(store.getAthletes());
    setLoading(false);
    return store.subscribe(() => setAthletes(store.getAthletes()));
  }, []);

  const addAthlete = useCallback(
    (data: Omit<Athlete, "id">) => store.addAthlete(data),
    []
  );
  const updateAthlete = useCallback(
    (id: string, patch: Partial<Omit<Athlete, "id">>) => store.updateAthlete(id, patch),
    []
  );
  const deleteAthlete = useCallback((id: string) => store.deleteAthlete(id), []);

  return { athletes, loading, addAthlete, updateAthlete, deleteAthlete };
}
