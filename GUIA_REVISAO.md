# Guia de revisão — onde está o processamento

Projeto completo da plataforma **BEL Monitor / SESI Sprint** (Next.js + backend Python + firmware ESP32).
Este guia aponta, **nos arquivos reais**, onde estão os pontos que o grupo quer conferir:
**distância, velocidade, velocidade instantânea e ângulo**, e como o `.py` do grupo se integra.

## 1. Onde cada ponto é calculado (ao vivo, por frame)

Arquivo central: **`src/hooks/useLocalLiveSession.ts`** — converte o stream da ESP em números.

| Ponto | Arquivo | Linha |
|---|---|---|
| **Distância** (deslocamento dos pulsos) | `src/hooks/useLocalLiveSession.ts` | **243** (constantes 45‑55) |
| **Velocidade** | `src/hooks/useLocalLiveSession.ts` | **247** |
| **Velocidade instantânea** (campo por frame) | `src/hooks/useLocalLiveSession.ts` | 307 |
| **Velocidade de pico / saída** | `src/lib/analysis.ts` | 27 |
| **Ângulo** (giroscópio → yaw → \|L−R\|) | `src/hooks/useLocalLiveSession.ts` | **253‑290** |

## 2. Finalização das métricas (de frame → tentativa salva)

| Métrica | Arquivo | Linha |
|---|---|---|
| **Ângulo de largada** (valor ao cruzar 10 m) | `src/features/live/LiveDashboard.tsx` | 129‑140, 187 |
| **Parciais** (t10m, t30m, tFinal), **pico salvo**, **status** | `src/features/live/LiveDashboard.tsx` | 171‑220 |
| **CSV do relatório** (parciais, vel. média) | `src/lib/exportCsv.ts` | — |
| **Dashboard** (recordes, progressão) | `src/hooks/useAthleteStats.ts` | — |

## 3. O método do grupo (.py) e a integração

- **Base:** `PBL7_Carretilha/analise_completaPBL.py` — ângulo giro→yaw (linhas 116‑133) + usa `Vel_ms`. **Não calcula distância.**
- **Ao vivo em Python:** `local-mvp/run_angulo.py` (mesmo método + remoção de bias).
- **Portado para a plataforma:** `src/hooks/useLocalLiveSession.ts` (giro→yaw nas linhas 280‑288; mesmo corte de 2 Hz).

## 4. Origem dos dados (firmware ESP32)

- **Carretilha:** `PBL7_Carretilha/PBL_mpu_encoder.ino` (pulsos + Vel_ms + IMU local + recebe o atleta).
- **Atleta:** `PBL7_Carretilha/PBL_mpu(1).ino` (IMU acel + giro via ESP‑NOW).
- **Backend:** `local-mvp/server.py` (lê a serial → WebSocket).

## 5. ⚠️ Pontos em aberto (conclusões da revisão)

1. **Giroscópio:** o firmware atual manda **9 colunas SEM giroscópio** (a carretilha descarta o giro do
   atleta), mas a plataforma e o `.py` esperam **15 colunas com giroscópio** → o ângulo de largada fica
   sem entrada. Conserto: a carretilha ler/imprimir as 15 colunas (o atleta já envia os 6 floats).
2. **Distância/diâmetro:** o que **bate na pista** é `0,05 × 1,5 = 0,075` efetivo. O firmware usa 0,068
   (não bate). A razão do teste (18 m → 12 m = 1,5) aponta para **encoder ~400 PPR**, não 600. Melhor:
   calibrar metros‑por‑pulso direto de uma corrida medida com trena.
3. **Velocidade:** pode sair ~36% alta se o firmware (0,068) for o que roda, porque a distância usa
   0,05 × 1,5 e a velocidade usa o `Vel_ms` da ESP (0,068) × 1,5. Alinhar o diâmetro resolve.

## 6. Como rodar

- **Frontend:** `npm install` e depois `npm run dev` → http://localhost:3001
- **Backend:** dentro de `local-mvp/`: `pip install -r requirements.txt` e `python server.py`
- Mais detalhes: `README.md`, `SETUP_GRUPO.md`, `TUTORIAL_GRUPO.md`.
