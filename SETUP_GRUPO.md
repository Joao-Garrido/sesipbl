# BEL Monitor — Setup para o Grupo (Dev)

Projeto fim-a-fim. Roda em qualquer Windows 10/11.

## Pré-requisitos

1. **Python 3.10+** (https://www.python.org/downloads/) — marcar "Add to PATH"
2. **Node.js 18+** (https://nodejs.org/) — versão LTS

## Setup (1 única vez)

```cmd
:: 1. Descompacta o zip em qualquer pasta
:: 2. Abre terminal nessa pasta

:: 3. Instala dependencias do Python
cd local-mvp
INSTALAR.bat
cd ..

:: 4. Instala dependencias do Node
npm install
:: (demora ~3-5 min na primeira vez)

:: 5. Configura porta COM da ESP (se for usar ESP real)
notepad local-mvp\.env
:: troca PORTA_SERIAL=COM3 pelo seu COM

:: 6. Configura WebSocket no frontend
notepad .env.local
:: ja vem preenchido — nao precisa mexer normalmente
```

## Uso

Precisa de 2 janelas abertas ao mesmo tempo:

### Janela 1 — backend Python
```cmd
cd local-mvp
SIMULAR.bat       :: simulador (sem hardware)
:: OU
INICIAR.bat       :: ESP real plugada
```

### Janela 2 — frontend Next.js
```cmd
npm run dev
```
Abre http://localhost:3001/live

## (Opcional) Janelas 3+ — clientes Python adicionais

```cmd
cd local-mvp
RUN_ANGULO.bat    :: imprime angulo no console usando o algoritmo do PBL7_Carretilha/angulo_imus.py
RUN_PLOT.bat      :: matplotlib live da velocidade (estilo plot_encoder.py)
```

Todos consomem o mesmo WebSocket do `server.py`.

## Arquitetura

```
ESP Atleta (powerbank)
       │ ESP-NOW (canal 1 travado)
       ▼
ESP Carretilha (USB no PC)
       │ Serial CSV 15 colunas
       ▼
local-mvp/server.py
       │ WebSocket :8000/ws
       ▼
┌──────────────┬──────────────┬──────────────┐
│ Next.js      │ run_angulo.py│ run_plot.py  │
│ :3001/live   │ console      │ matplotlib   │
└──────────────┴──────────────┴──────────────┘
```

## Sketches Arduino

Em `PBL7_Carretilha/`:
- `ESP_Carretilha/ESP_Carretilha.ino` — flashar na ESP da carretilha
- `ESP_Atleta/ESP_Atleta.ino` — flashar na ESP do atleta

Arduino IDE 2.x, Board: ESP32S3 Dev Module. Canal ESP-NOW travado em 1 nos 2.

## Estrutura

```
pbl-grupo-1-cinematic/
├── src/                          # Next.js app (React 19 + Tailwind 4)
│   ├── app/(dashboard)/live/     # tela ao vivo
│   ├── features/live/            # widgets (gauges, charts)
│   ├── hooks/useLocalLiveSession # WebSocket → LiveFrame
│   └── lib/                      # types, firebase, utils
├── local-mvp/                    # backend Python
│   ├── server.py                 # Serial → WebSocket
│   ├── run_angulo.py             # cliente WS usando angulo_imus.py
│   ├── run_plot.py               # cliente WS matplotlib
│   └── static/index.html         # dashboard alternativo (standalone, sem Next)
├── PBL7_Carretilha/              # sketches + scripts originais
│   ├── ESP_Carretilha/           # sketch carretilha
│   ├── ESP_Atleta/               # sketch atleta
│   ├── angulo_imus.py            # algoritmo original (com __main__ guard)
│   └── plot_encoder.py           # original (legado)
├── bridge/                       # bridge antigo (Firebase, multi-Serial — legado)
├── package.json
└── .env.local                    # NEXT_PUBLIC_LOCAL_WS_URL=ws://localhost:8000/ws
```

## Variáveis de ambiente

### `local-mvp/.env`
```
PORTA_SERIAL=COM3        # ajustar
BAUD=115200
HTTP_PORT=8000
SIMULATE=0               # 1 pra forçar simulador, 0 pra Serial
```

### `.env.local` (raiz)
```
NEXT_PUBLIC_LOCAL_WS_URL=ws://localhost:8000/ws
```
Se essa variável NÃO estiver setada, o frontend volta a usar Firebase/mock.

## Limitações conhecidas

- Sketches do atleta e carretilha **DEVEM** estar no mesmo canal Wi-Fi (já fixado em `#define ESPNOW_CHANNEL 1` nos `.ino`).
- O hook `useLocalLiveSession` mantém últimas 600 amostras na memória — sessões muito longas (>1 min @ 100Hz) podem ficar pesadas.
- Sem persistência: ao parar/iniciar, histórico não fica salvo no Postgres/Firebase (precisa adicionar depois).
- `signalRssi`, `battery`, `cpuTempC`, `cadence` — ESP não envia, UI mostra "—".

## Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| `npm install` falha | Node antigo | Instalar Node 18+ |
| `python -m venv` falha | Python sem venv | Reinstalar Python completo |
| `could not open port` | Arduino IDE / Monitor aberto | Fechar |
| Dashboard 🔴 | server.py não rodando | Subir janela 1 |
| WS desconecta | Firewall | Permitir acesso |
| ESP-NOW silencioso | Canal Wi-Fi divergente | Confirmar `ESPNOW_CHANNEL=1` nos 2 sketches |
