// Persistência do histórico (atletas + tentativas) na MÁQUINA do usuário.
//
// Duas camadas:
//   1. localStorage  → cache instantâneo, funciona offline.
//   2. disco (backend server.py, data/store.json) → fonte durável: sobrevive a
//      trocar/limpar o navegador e pode ser copiada para backup.
//
// A cada mudança grava no localStorage e sincroniza pro disco (debounced).
// Ao carregar, puxa o disco e funde (união por id — nunca perde dado).
// SSR-safe: todas as funções guardam `window`.

import { mockAthletes } from "./mock";
import type { CalibrationMode } from "./calibration";
import type { Athlete, Attempt, Session } from "./types";

const KEYS = {
  athletes: "bel-grupo:athletes:v1",
  attempts: "bel-grupo:attempts:v1",
  calibration: "bel-grupo:calibration:v1",
} as const;

const CHANGE_EVENT = "bel-grupo:store-change";

// Id do antigo atleta placeholder "Atleta Teste". É FILTRADO de toda a app (lista de
// atletas e tentativas) — some da UI e, no próximo sync, sai do store.json também.
const LEGACY_TEST_ID = "atl-teste";

// Base HTTP do backend local, derivada da URL do WebSocket.
// ws://localhost:8000/ws -> http://localhost:8000
const WS_URL = process.env.NEXT_PUBLIC_LOCAL_WS_URL || "";
const API_BASE = WS_URL ? WS_URL.replace(/^ws/i, "http").replace(/\/ws\/?$/i, "") : "";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function readRaw<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Grava só no localStorage (sem evento, sem push pro disco). Uso interno. */
function writeLocal<T>(key: string, value: T): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("[localStore] falha ao salvar", key, err);
  }
}

/** Grava no localStorage + notifica consumidores + agenda persistência em disco. */
function write<T>(key: string, value: T): void {
  if (!hasWindow()) return;
  writeLocal(key, value);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  scheduleDiskPush();
}

/** Assina mudanças (mesma aba via evento custom, outras abas via "storage"). */
export function subscribe(cb: () => void): () => void {
  if (!hasWindow()) return () => {};
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// ----------------------------------------------------------------
// Sincronização com o disco (backend server.py → data/store.json)
// ----------------------------------------------------------------
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDiskPush(): void {
  if (!API_BASE || !hasWindow()) return;
  if (pushTimer) clearTimeout(pushTimer);
  // Debounce: agrupa rajadas de mudanças e dá tempo do hydrate terminar antes.
  pushTimer = setTimeout(() => {
    const payload = { athletes: getAthletes(), attempts: getAttempts() };
    fetch(`${API_BASE}/api/store`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      /* backend desligado: continua só no localStorage até voltar */
    });
  }, 400);
}

function mergeById<T extends { id: string }>(local: T[], disk: T[]): T[] {
  const map = new Map<string, T>();
  for (const d of disk) map.set(d.id, d);
  for (const l of local) map.set(l.id, l); // edição local prevalece sobre o disco
  return Array.from(map.values());
}

/**
 * Puxa o histórico do disco e funde com o localStorage (união por id — nunca
 * perde dado). Chamado uma vez ao carregar o app (ver StoreSync).
 */
export async function hydrateFromDisk(): Promise<void> {
  if (!API_BASE || !hasWindow()) return;
  try {
    const res = await fetch(`${API_BASE}/api/store`);
    if (!res.ok) return;
    const data = await res.json();
    const diskAthletes: Athlete[] = Array.isArray(data.athletes) ? data.athletes : [];
    const diskAttempts: Attempt[] = Array.isArray(data.attempts) ? data.attempts : [];
    // Atletas: união por id (podem ser criados offline, não pode perder).
    writeLocal(KEYS.athletes, mergeById(getAthletes(), diskAthletes));
    // Tentativas: o disco é a fonte da verdade (só são criadas com o backend
    // ligado, então já estão no disco). Isso também permite limpar histórico
    // zerando o store.json. Disco vazio = limpo.
    writeLocal(KEYS.attempts, diskAttempts);
    window.dispatchEvent(new Event(CHANGE_EVENT)); // hooks re-leem com o histórico do disco
    scheduleDiskPush(); // garante o disco em dia (ex: atletas criados offline)
  } catch {
    /* backend desligado: segue com o localStorage */
  }
}

// ----------------------------------------------------------------
// Atletas
// ----------------------------------------------------------------
export function getAthletes(): Athlete[] {
  if (!hasWindow()) return mockAthletes;
  const raw = window.localStorage.getItem(KEYS.athletes);
  if (raw == null) return mockAthletes; // vazio agora (sem placeholder de teste)
  try {
    // Filtra o atleta teste legado, caso já tenha sido salvo antes.
    return (JSON.parse(raw) as Athlete[]).filter((a) => a.id !== LEGACY_TEST_ID);
  } catch {
    return mockAthletes;
  }
}

export function saveAthletes(list: Athlete[]): void {
  write(KEYS.athletes, list);
}

export function addAthlete(data: Omit<Athlete, "id">): Athlete {
  const athlete: Athlete = { ...data, id: `atl-${Date.now()}` };
  saveAthletes([...getAthletes(), athlete]);
  return athlete;
}

export function updateAthlete(id: string, patch: Partial<Omit<Athlete, "id">>): void {
  saveAthletes(getAthletes().map((a) => (a.id === id ? { ...a, ...patch } : a)));
}

export function deleteAthlete(id: string): void {
  saveAthletes(getAthletes().filter((a) => a.id !== id));
  saveAttempts(getAttempts().filter((t) => t.athleteId !== id)); // remove tentativas órfãs
}

// ----------------------------------------------------------------
// Tentativas
// ----------------------------------------------------------------
export function getAttempts(): Attempt[] {
  // Filtra as tentativas do atleta teste legado (saem da comparação, sessões e relatórios).
  return readRaw<Attempt[]>(KEYS.attempts, []).filter((a) => a.athleteId !== LEGACY_TEST_ID);
}

function saveAttempts(list: Attempt[]): void {
  write(KEYS.attempts, list);
}

export function getAttemptsBySession(sessionId: string): Attempt[] {
  // Renumera limpo por ordem cronológica (1,2,3…) — robusto mesmo que o `numero`
  // gravado tenha ficado inconsistente.
  return getAttempts()
    .filter((a) => a.sessionId === sessionId)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((a, i) => ({ ...a, numero: i + 1 }));
}

export function getAttemptsByAthlete(athleteId: string): Attempt[] {
  return getAttempts()
    .filter((a) => a.athleteId === athleteId)
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** Upsert idempotente por id (auto-stop e "Encerrar" podem chamar para a mesma tentativa). */
export function saveAttempt(attempt: Attempt): void {
  const list = getAttempts();
  const idx = list.findIndex((a) => a.id === attempt.id);
  if (idx >= 0) list[idx] = attempt;
  else list.push(attempt);
  saveAttempts(list);
}

export function deleteAttempt(id: string): void {
  saveAttempts(getAttempts().filter((a) => a.id !== id));
}

// ----------------------------------------------------------------
// Sessões (derivadas das tentativas)
// ----------------------------------------------------------------
export function getSessions(): Session[] {
  const byId = new Map<string, Session>();
  for (const a of getAttempts()) {
    let s = byId.get(a.sessionId);
    if (!s) {
      s = {
        id: a.sessionId,
        athleteId: a.athleteId,
        data: new Date(a.startedAt).toISOString().slice(0, 10),
        attempts: [],
      };
      byId.set(a.sessionId, s);
    }
    s.attempts.push(a);
  }
  const sessions = Array.from(byId.values());
  sessions.forEach((s) => s.attempts.sort((x, y) => x.numero - y.numero));
  sessions.sort((x, y) => (y.attempts[0]?.startedAt ?? 0) - (x.attempts[0]?.startedAt ?? 0));
  return sessions;
}

export function getSessionsByAthlete(athleteId: string): Session[] {
  return getSessions().filter((s) => s.athleteId === athleteId);
}

// ----------------------------------------------------------------
// Calibracao (preferencia do treinador, por maquina)
// ----------------------------------------------------------------
// Padrao vem do env (NEXT_PUBLIC_CALIBRATION_MODE); a escolha na plataforma
// (localStorage) sobrepoe. So fica no localStorage — nao vai pro store.json.
const ENV_CALIBRATION_DEFAULT: CalibrationMode =
  process.env.NEXT_PUBLIC_CALIBRATION_MODE === "frontend" ? "frontend" : "firmware";

export function getCalibrationMode(): CalibrationMode {
  if (!hasWindow()) return ENV_CALIBRATION_DEFAULT;
  // writeLocal serializa via JSON.stringify, entao a leitura tem de fazer JSON.parse
  // (readRaw) para casar; comparar a string crua quebraria por causa das aspas.
  const mode = readRaw<CalibrationMode>(KEYS.calibration, ENV_CALIBRATION_DEFAULT);
  return mode === "frontend" || mode === "firmware" ? mode : ENV_CALIBRATION_DEFAULT;
}

export function setCalibrationMode(mode: CalibrationMode): void {
  if (!hasWindow()) return;
  writeLocal(KEYS.calibration, mode);
  window.dispatchEvent(new Event(CHANGE_EVENT)); // hooks/UI re-leem na hora
}

// ----------------------------------------------------------------
// Backup manual (exportar / importar JSON)
// ----------------------------------------------------------------
export function exportData(): string {
  return JSON.stringify(
    { athletes: getAthletes(), attempts: getAttempts(), exportedAt: Date.now() },
    null,
    2
  );
}

export function importData(json: string): void {
  const data = JSON.parse(json);
  if (Array.isArray(data.athletes)) writeLocal(KEYS.athletes, mergeById(getAthletes(), data.athletes));
  if (Array.isArray(data.attempts)) writeLocal(KEYS.attempts, mergeById(getAttempts(), data.attempts));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  scheduleDiskPush();
}
