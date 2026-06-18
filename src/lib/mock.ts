// Mock data — VAZIO. Sem atletas/sessões/PRs fake. O treinador cadastra os atletas
// reais em "Atletas"; o histórico vem do backend local (data/store.json).
// (Antes havia um "Atleta Teste" placeholder — removido a pedido; ver localStore,
//  que também filtra o id legado "atl-teste" de dados já salvos.)

import type { Athlete, Attempt, Session, VelocityPoint } from "./types";

// --- sem atleta placeholder ---
export const mockAthletes: Athlete[] = [];

// --- bio (vazio) ---
export interface AthleteBio {
  athleteId: string;
  idade: number;
  altura: number;
  peso: number;
  prSaida: number;
  prVelocidade: number;
  prTime: number | null; // melhor tempo na distância principal do atleta
  prDistance: number;    // distância principal (m)
  treinosSemana: number;
  cargaTreino: number;
  fadigaPercebida: number;
  totalSessoes: number;
}

export const mockBios: Record<string, AthleteBio> = {};

// --- attempts (vazio) ---
export const mockAttempts: Attempt[] = [];

// --- sessions (vazio) ---
export const mockSessions: Session[] = [];

// --- historico semanal (vazio) ---
export interface SessionSummary {
  id: string;
  date: string;
  label: string;
  peakVelocity: number;
  exitVelocity: number; // velocidade média dos primeiros 200 pontos (saída)
  exitAngle: number;
  collectedAngle: number; // ângulo de saída coletado (findPeaks do firmware)
  bestT100m: number | null; // null = nenhuma tentativa completou 100m nesta sessão
  consistency: number;
  attemptsCount: number;
}

export const mockHistoryByAthlete: Record<string, SessionSummary[]> = {};
export const mockHistory: SessionSummary[] = [];

// --- insights AI (vazio) ---
export interface AIInsight {
  id: string;
  severity: "info" | "warning" | "positive";
  title: string;
  body: string;
  metric?: string;
}

export const mockInsightsByAthlete: Record<string, AIInsight[]> = {};
export const mockInsights: AIInsight[] = [];

// --- leaderboard (vazio) ---
export interface AthleteRanking {
  athleteId: string;
  nome: string;
  categoria: string;
  bestVel: number;
  bestT100m: number;
  trend: number;
  lastSession: string;
}

export const mockLeaderboard: AthleteRanking[] = [];

// --- proximos treinos (vazio) ---
export interface UpcomingSession {
  id: string;
  athleteId: string;
  athleteName: string;
  date: string;
  hora: string;
  foco: string;
}

export const mockUpcoming: UpcomingSession[] = [];

// --- PRs (vazio) ---
export interface PRRecord {
  id: string;
  athleteId: string;
  metric: "vel" | "t100m" | "tempo" | "ang" | "t10m";
  label: string;
  value: string;
  date: string;
  delta?: string;
}

export const mockPRsByAthlete: Record<string, PRRecord[]> = {};

// --- radar tecnica (vazio) ---
export interface TechniqueScore {
  athleteId: string;
  saida: number;
  aceleracao: number;
  velocidadeMax: number;
  manutencao: number;
  consistencia: number;
}

export const mockTechniqueByAthlete: Record<string, TechniqueScore> = {};

// Helper exportado pra eventual uso futuro (mantem assinatura)
export function genCurve(_peak: number, _dur: number = 12, _dt: number = 0.05): VelocityPoint[] {
  return [];
}
