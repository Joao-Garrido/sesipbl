# Dados de coleta (sprint × carretilha)

Coletas **reais** de corrida capturadas pela carretilha instrumentada (ESP32 + encoder + IMU),
uma tentativa por arquivo `.csv`. São o **stream cru, literal** que a ESP envia pela serial —
o mesmo formato que o `server.py` registra e que os scripts Python esperam.

> **Anonimizado:** os atletas aparecem só como `Atleta1`, `Atleta2`… (sem nomes/dados
> pessoais). Arquivos do mesmo `AtletaN` são tentativas da mesma pessoa. As colunas são
> apenas medidas de sensor — não contêm informação pessoal.

## Formato (5 colunas)

```
time,Ax,Angulo_graus,Pulsos,Vel_ms
```

| coluna | unidade | descrição |
|---|---|---|
| `time` | ms | `millis()` da ESP |
| `Ax` | g | aceleração no eixo X (IMU) |
| `Angulo_graus` | ° | ângulo já calculado no firmware (`asin(ax)·180/π`) |
| `Pulsos` | — | contagem acumulada do encoder |
| `Vel_ms` | m/s | velocidade calculada no firmware |

Separador vírgula, ponto decimal, 1 linha de cabeçalho, ~125 amostras/s.

## Como usar

**Python** (`codigos/2_processamento_python/`):
- `ajuste_plot_vel.py` → velocidade ao longo do tempo + velocidade de saída (média dos 1ºs 1000 pts).
- `angulo_fio.py` → ângulo de largada (passa-baixa Butterworth 5 Hz + `find_peaks`).
- Aponte `CSV_PATH` para um arquivo desta pasta (ambos usam `header=None, names=COLUNAS, skiprows=1`).

**Plataforma:** cada arquivo equivale a uma tentativa; o botão **"Bruto"** (em Tentativas/Relatório)
exporta exatamente neste formato.

## Arquivos

| arquivo | atleta | prova | amostras |
|---|---|---|---|
| Atleta1_18m_T1.csv | Atleta1 | 18 m | 1414 |
| Atleta2_18m_T1.csv | Atleta2 | 18 m | 1449 |
| Atleta2_100m_T2.csv | Atleta2 | 100 m | 1713 |
| Atleta3_100m_T1.csv | Atleta3 | 100 m | 1154 |
| Atleta3_100m_T2.csv | Atleta3 | 100 m | 1498 |
| Atleta4_100m_T1.csv | Atleta4 | 100 m | 1305 |
| Atleta5_18m_T1.csv | Atleta5 | 18 m | 1726 |
| Atleta6_100m_T1.csv | Atleta6 | 100 m | 1496 |
| Atleta7_18m_T1.csv | Atleta7 | 18 m | 1539 |
| Atleta7_30m_T2.csv | Atleta7 | 30 m | 1106 |
| Atleta7_25m_T3.csv | Atleta7 | 25 m | 1114 |
| Atleta7_20m_T4.csv | Atleta7 | 20 m | 851 |
| Atleta7_18m_T5.csv | Atleta7 | 18 m | 673 |

Projeto SESI PBL — análise cinemática de sprint.
