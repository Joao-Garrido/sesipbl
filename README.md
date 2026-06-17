# Análise Cinemática — PBL Grupo 1

Dashboard para treinadores de atletas paralímpicos. Mede velocidade/aceleração instantânea e ângulo na saída de bloco (100m), via encoder + IMU + ESP32 → Firebase.

**Responsável:** João Garrido (REQ-12 + REQ-13)

## Quick start

```bash
cd "PBL GRUPO 1"
npm install
npm run dev
```

Abre em http://localhost:3001 — já roda em **mock mode** (sem Firebase configurado).

## Configurar Firebase (opcional)

```bash
cp .env.example .env.local
# preencher 7 variáveis NEXT_PUBLIC_FIREBASE_*
```

## Estrutura

- `/live` — REQ-13: 3 KPIs grandes + curva velocidade tempo real + gauge ângulo
- `/relatorio` — REQ-12: comparativo overlay tentativas + tabela métricas + perfil por fase
- `/atletas` — cadastro com referência ângulo/velocidade
- `/sessoes` — histórico
- `/configuracoes` — status hardware + calibração

## Tela ao Vivo (REQ-13)

```
┌─────────────────┬────────────────┬────────────────────┐
│   VELOCIDADE    │   ACELERAÇÃO   │   ÂNGULO SAÍDA     │
│   8.2 m/s  🟢   │   3.1 m/s² 🟡  │     42.3°  🟢      │
├─────────────────┴────────────────┴────────────────────┤
│  CURVA DE VELOCIDADE      │   ÂNGULO LARGADA          │
│  [area chart]             │   [gauge SVG ±5°]         │
└────────────────────────────────────────────────────────┘
```

## Firebase data shape

```
/live/{attemptId}                              ← Realtime DB (latência <200ms)
  { ts, velocity, acceleration, angle, displacement, elapsed }

/athletes/{id}                                 ← Firestore (queries)
/athletes/{id}/sessions/{sessionId}
/athletes/{id}/sessions/{sessionId}/attempts/{n}
  { metrics: { peakVel, peakAccel, startAngle, t10m, ... },
    velocityCurve: [{ t, v, a, d }, ...] }
```

## Reuso do Vinlet

Components, tokens, padrão mock-fallback, layout shell — tudo adaptado de `../clinic-saas/`. Ver `CLAUDE.md` para mapeamento completo.
