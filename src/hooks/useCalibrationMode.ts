"use client";

// Preferencia de calibracao do treinador, reativa (localStorage via localStore).
// Mesma forma do useAthletes: le no mount, assina mudancas, devolve valor + setter.

import { useCallback, useEffect, useState } from "react";
import * as store from "@/lib/localStore";
import type { CalibrationMode } from "@/lib/calibration";

export function useCalibrationMode() {
  const [mode, setMode] = useState<CalibrationMode>("firmware");

  useEffect(() => {
    setMode(store.getCalibrationMode());
    return store.subscribe(() => setMode(store.getCalibrationMode()));
  }, []);

  const setCalibrationMode = useCallback(
    (m: CalibrationMode) => store.setCalibrationMode(m),
    []
  );

  return { mode, setCalibrationMode };
}
