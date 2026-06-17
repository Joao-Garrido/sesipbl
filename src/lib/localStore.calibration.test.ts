import { describe, it, expect, beforeEach, vi } from "vitest";

// localStore guarda em window.localStorage (SSR-safe via hasWindow()). O ambiente
// padrao do vitest e "node" (sem window), entao montamos um stub minimo de window
// com localStorage de verdade (Map) + addEventListener/dispatchEvent no-op.
function makeWindowStub() {
  const map = new Map<string, string>();
  return {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

describe("localStore calibration round-trip", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", makeWindowStub());
  });

  it("setCalibrationMode('frontend') persiste e getCalibrationMode() le 'frontend'", async () => {
    const store = await import("./localStore");
    store.setCalibrationMode("frontend");
    expect(store.getCalibrationMode()).toBe("frontend");
  });

  it("setCalibrationMode('firmware') persiste e getCalibrationMode() le 'firmware'", async () => {
    const store = await import("./localStore");
    store.setCalibrationMode("firmware");
    expect(store.getCalibrationMode()).toBe("firmware");
  });

  it("alterna frontend -> firmware -> frontend (toggle real)", async () => {
    const store = await import("./localStore");
    store.setCalibrationMode("frontend");
    expect(store.getCalibrationMode()).toBe("frontend");
    store.setCalibrationMode("firmware");
    expect(store.getCalibrationMode()).toBe("firmware");
    store.setCalibrationMode("frontend");
    expect(store.getCalibrationMode()).toBe("frontend");
  });
});
