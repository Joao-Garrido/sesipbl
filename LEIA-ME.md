# Revisão do processamento — BEL Monitor (SESI Sprint)

Esta pasta reúne **os arquivos onde a lógica acontece** — distância, velocidade, velocidade
instantânea e ângulo — separados do resto do app (UI de telas, build, dependências). O objetivo é o
grupo conferir **se as contas estão certas** e **como o `.py` (`analise_completaPBL.py`) está
integrado na plataforma**.

> ⚙️ **Esta pasta é GERADA automaticamente** a partir dos arquivos reais do projeto.
> Não edite aqui — edite o arquivo na origem (`PBL7_Carretilha\`, `local-mvp\`, `src\`) e rode
> `_revisao\atualizar_zip.bat` para regenerar. O pacote é conferido por hash a cada geração.

---

## 1. Fluxo de dados (firmware ATUAL das ESPs)

```
   ESP do ATLETA (cintura)                    ESP da CARRETILHA (no carretel)
   PBL_mpu(1).ino                             PBL_mpu_encoder.ino
   lê IMU: acel + giro ───ESP-NOW(rádio)──▶   recebe o atleta (SÓ acel — descarta o giro)
   envia 6 floats                             • conta PULSOS do encoder
                                              • calcula Vel_ms (a cada 100 ms)
                                              • lê o IMU local (SÓ acel)
                                                        │ USB / Serial 115200 · CSV 9 colunas
                                ┌───────────────────────┴───────────────────────┐
                                │ AO VIVO                     │ OFFLINE (análise) │
                                │ 3_backend\server.py         │ 2_..python\       │
                                │ serial → WebSocket          │ analise_completaPBL│
                                └───────────┬─────────────────┴─────────┬─────────┘
                                            │ WebSocket (JSON)          │ lê CSV gravado
                                ┌───────────▼─────────────────────────┐ └─ gráficos
                                │ 4_plataforma\useLocalLiveSession.ts  │
                                │   calcula distância/velocidade/ângulo│
                                │              │ por frame             │
                                │ 5_finalizacao\LiveDashboard.tsx      │
                                │   escolhe ângulo de largada, parciais│
                                │   e SALVA a tentativa                │
                                └──────────────────────────────────────┘
```

**As 9 colunas que o firmware atual manda** (`PBL_mpu_encoder.ino`, linha 129):
```
time, L_Ax,L_Ay,L_Az,  R_Ax,R_Ay,R_Az,  Pulsos, Vel_ms
```
`L_*` = IMU da carretilha · `R_*` = IMU do atleta · só **acelerômetro** · `Pulsos`/`Vel_ms` = encoder.

> ⚠️ Ver seção 8: o atleta até lê o **giroscópio**, mas a carretilha descarta, e a plataforma/`.py`
> esperam **15 colunas com giroscópio**. É o ponto nº 1 a reconciliar.

---

## 2. DISTÂNCIA (deslocamento)

```
distância = (Pulsos − Pulsos_inicial) / (PPR × 4) × (π × Diâmetro)
```
| Onde | Arquivo | Linha | Constante |
|---|---|---|---|
| Firmware gera `Pulsos` | `1_firmware_ESP/PBL_mpu_encoder.ino` | 17‑20, 190‑195 | PPR 600 · **Ø 0,068** |
| **Cálculo por frame** | `4_plataforma/useLocalLiveSession.ts` | 45‑55, **243** | Ø 0,05 **× 1,5** |
| **Distância final salva** (máx. + completa/parcial) | `5_finalizacao_metricas/LiveDashboard.tsx` | 176, 181 | — |

**✅ Fórmula correta.** A conferir: a **constante** (firmware usa 0,068; plataforma usa 0,05 × 1,5,
calibração de pista 18 m→12 m). Medir PPR/roda e unificar. O `analise_completaPBL.py` **não calcula
distância** (faz ângulo + velocidade).

---

## 3. VELOCIDADE

```
Vel_ms = (Δpulsos / (PPR × 4) × π × Diâmetro) / Δt        // Δt = 0,1 s, calculado na ESP
```
| Onde | Arquivo | Linha |
|---|---|---|
| Firmware calcula `Vel_ms` (Ø 0,068) | `1_firmware_ESP/PBL_mpu_encoder.ino` | 143‑165 |
| **`.py`** usa `Vel_ms` cru | `2_processamento_python/analise_completaPBL.py` | 159 |
| **Plataforma** usa `Vel_ms × 1,5` | `4_plataforma/useLocalLiveSession.ts` | **247** |
| **Pico salvo** (máx. da curva) | `5_finalizacao_metricas/LiveDashboard.tsx` | 177 |

**✅ Fórmula correta** (derivada do deslocamento). Mesma observação sobre a constante.

---

## 4. VELOCIDADE INSTANTÂNEA

A `Vel_ms` já é a velocidade instantânea: recalculada na ESP em janelas de **100 ms** (10 Hz).
- **Ao vivo:** campo `velocity` por frame (`useLocalLiveSession.ts:307`); a sequência forma a curva v×t.
- **Pico nos 1ºs 10% (saída):** `4_plataforma/analysis.ts` → `exitPeakVelocity()` (linha 27), chamado
  na finalização em `LiveDashboard.tsx:193`.

---

## 5. ÂNGULO entre as IMUs

Integra o **giroscópio Y** de cada IMU → *yaw*; ângulo = diferença:
```
L_Yaw = Σ (L_Gy · dt)        R_Yaw = Σ (R_Gy · dt)
ângulo = | L_Yaw − R_Yaw |   →  passa‑baixa 2 Hz
```
| Onde | Arquivo | Linha |
|---|---|---|
| **`.py` base** (offline) | `2_processamento_python/analise_completaPBL.py` | 116‑133 |
| **`.py` ao vivo** (+ bias) | `2_processamento_python/run_angulo.py` | 44‑119 |
| **Plataforma — ângulo por frame** | `4_plataforma/useLocalLiveSession.ts` | **253‑290** |
| **"Ângulo de largada" salvo** (valor ao CRUZAR 10m) | `5_finalizacao_metricas/LiveDashboard.tsx` | **129‑140, 187** |

> ⚠️ **Atenção (ponto importante da revisão):** o `useLocalLiveSession.ts` só calcula o ângulo cru,
> que **começa em 0 e cresce** (integração do giroscópio). Quem decide *qual valor vira o "ângulo de
> largada"* é o `LiveDashboard.tsx`: ele pega o valor **ao cruzar 10m** (`launchMark`, linha 136‑138).
> Sem o giroscópio (firmware atual de 9 colunas), esse ângulo não tem entrada.

**Ângulo do corpo (outra coisa):** `analysis.ts` (`bodyAngleCurve`, linha 56) = `90° + atan(a/g)`,
da velocidade, não da IMU. É o gráfico de técnica, separado do ângulo de largada.

---

## 6. Como o `.py` foi INTEGRADO na plataforma (mapa linha‑a‑linha)

| Conceito | `analise_completaPBL.py` | → | Plataforma (`useLocalLiveSession.ts`) |
|---|---|---|---|
| Integrar giro → yaw | 126‑127 | → | 280‑281, 285‑286 |
| Ângulo = \|L_Yaw − R_Yaw\| | 130 | → | 282, 287 |
| Passa‑baixa 2 Hz | 133 (Butterworth) | → | 263, 288 (causal) |
| Velocidade do encoder | 159 (`Vel_ms`) | → | 247 |

A plataforma acrescentou **remoção de bias** do giroscópio (`useLocalLiveSession.ts:265‑289`, igual
ao `run_angulo.py:94‑110`) e a **calibração ×1,5**; o filtro ao vivo é **causal** (offline o
Butterworth `filtfilt` faz ida e volta).

---

## 7. Finalização das métricas (pasta `5_finalizacao_metricas`)

O `useLocalLiveSession.ts` (seção 4) calcula os números **por frame**. É a pasta 5 que **transforma
isso nas métricas salvas** de cada tentativa e nos relatórios:

- **`LiveDashboard.tsx`** — finaliza e salva a tentativa (`persistAttempt`, linhas 171‑220):
  - **ângulo de largada** = valor ao cruzar 10m (129‑140, 187);
  - **pico de velocidade** = máx. da curva (177);
  - **parciais** t10m / t30m / tFinal = 1º instante que cruza cada distância (188, 194‑197);
  - **consistência** vs referência (198‑201) e **status** completa/parcial (181, 211).
- **`exportCsv.ts`** — monta o CSV do relatório para o Excel; recalcula os **parciais** (`splitAt`,
  tempo em cada distância) e a velocidade média.
- **`useAthleteStats.ts`** — **agrega entre tentativas** para o dashboard: recordes (PRs), progressão
  por sessão/tentativa e consistência. (Não é cálculo de uma corrida, é o resumo de várias.)

---

## 8. ⚠️ Estado atual a reconciliar (para o grupo decidir)

1. **Colunas: firmware manda 9, processamento espera 15.** `server.py` (46‑51) e
   `analise_completaPBL.py` (14‑19) esperam 15 colunas; com 9, o `server.py` descarta tudo.
2. **Giroscópio:** a carretilha (`PBL_mpu_encoder.ino`) descarta o giro do atleta (struct de 3
   floats) e não lê o giro local; mas o **ângulo de largada precisa do giroscópio**. O atleta
   (`PBL_mpu(1).ino`) já manda os 6 floats — bastaria a carretilha ler/imprimir as 15 colunas.
3. **Diâmetro:** firmware 0,068 vs plataforma 0,05 × 1,5. Medir PPR/roda e unificar.
4. **Quantização 100 ms:** velocidade/instantânea têm resolução de 10 Hz (limite do firmware).

> Em resumo: **distância e velocidade funcionam**; pendente é o **giroscópio para o ângulo** e
> **unificar o diâmetro/calibração**.

---

## 9. Conteúdo da pasta

```
1_firmware_ESP/            O que roda DENTRO das ESP (origem dos dados)
  PBL_mpu_encoder.ino        ESP da CARRETILHA: pulsos + Vel_ms + IMU local + recebe atleta (9 colunas)
  PBL_mpu(1).ino             ESP do ATLETA: lê IMU (acel + giro) e envia por ESP-NOW

2_processamento_python/    O QUE O GRUPO FEZ
  analise_completaPBL.py     ângulo (giro→yaw) + velocidade, a partir do CSV  ← método base
  run_angulo.py              o mesmo ângulo AO VIVO via WebSocket, com remoção de bias

3_backend/
  server.py                  lê a serial da ESP e repassa por WebSocket (ponte ESP → navegador)

4_plataforma/              CÁLCULO POR FRAME (o que a plataforma roda ao vivo)
  useLocalLiveSession.ts     distância, velocidade, velocidade instantânea e ângulo, por frame
  analysis.ts                velocidade de saída/pico + ângulo do corpo (modelo)
  phases.ts                  fases da corrida por distância da prova
  types.ts                   formato dos dados (o "contrato" de cada campo)

5_finalizacao_metricas/    DE FRAME → MÉTRICA SALVA / RELATÓRIO / DASHBOARD
  LiveDashboard.tsx          finaliza a tentativa: ângulo de largada (10m), parciais, pico, status
  exportCsv.ts               parciais + velocidade média do relatório (CSV Excel)
  useAthleteStats.ts         agregação entre tentativas (recordes, progressão) p/ o dashboard
```
