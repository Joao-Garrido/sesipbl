"use client";
// Sincroniza o histórico local com o disco (backend) uma vez ao carregar o app.
// Renderiza nada — só dispara o hydrate. Colocado no layout do dashboard.
import { useEffect } from "react";
import { hydrateFromDisk } from "@/lib/localStore";

export function StoreSync() {
  useEffect(() => {
    hydrateFromDisk();
  }, []);
  return null;
}
