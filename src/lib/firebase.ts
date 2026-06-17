// Firebase singleton — RTDB (tempo real) + Firestore (histórico)
// Mock mode ativo quando env vars ausentes (espelha padrão Vinlet)

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let _rtdb: Database | null = null;
let _fs: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps()[0] ?? initializeApp(config);
  _rtdb = getDatabase(app);
  _fs = getFirestore(app);
}

export const rtdb = _rtdb;
export const firestore = _fs;
export const firebaseApp = app;

/**
 * Estrutura sugerida no Firebase:
 *
 * Realtime DB (latência <200ms):
 *   /live/{attemptId}
 *     ts, velocity, acceleration, angle, displacement, elapsed
 *
 * Firestore (histórico/queries):
 *   /athletes/{id}
 *   /athletes/{id}/sessions/{sessionId}
 *   /athletes/{id}/sessions/{sessionId}/attempts/{n}
 *     metrics: { peakVel, peakAccel, startAngle, t10m, ... }
 *     velocityCurve: [{ t, v, a, d }, ...]
 */
