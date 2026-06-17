# Análise Cinemática — PBL Grupo 1

Dashboard para treinadores de atletas paralímpicos. Mede velocidade/aceleração instantânea e ângulo na saída de bloco (20m), via encoder + IMU + ESP32 → Firebase.

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

