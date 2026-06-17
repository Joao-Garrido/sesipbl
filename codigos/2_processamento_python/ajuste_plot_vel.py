import pandas as pd
import matplotlib.pyplot as plt
import serial
import time
import sys
from scipy.signal import butter, filtfilt

CSV_PATH    = 'dados_coleta.csv'
COLUNAS     = ['time', 'Ax', 'Angulo_graus', 'Pulsos', 'Vel_ms']
PORTA_SERIAL = 'COM4'
BAUD_RATE   = 115200
TIMEOUT_DESCONECTADO = 3

JANELA_MEDIA_MOVEL = 12   # pontos (estava 3 antes)
N_INICIO           = 1000 # primeiros N para velocidade de saída


# ── COLETA SERIAL ─────────────────────────────────────────────────────────────
print(f'Conectando na {PORTA_SERIAL}...')

try:
    ser = serial.Serial(PORTA_SERIAL, BAUD_RATE, timeout=1)
    time.sleep(2)
    ser.reset_input_buffer()
    print('ESP conectada. Desconecte para encerrar.\n')

    ultimo_dado    = time.time()
    iniciou_coleta = False

    with open(CSV_PATH, 'w', encoding='utf-8') as f:
        while True:
            try:
                if ser.in_waiting > 0:
                    linha = ser.readline().decode('utf-8', errors='ignore').strip()
                    if linha:
                        print(linha)
                        f.write(linha + '\n')
                        f.flush()
                        ultimo_dado    = time.time()
                        iniciou_coleta = True

                if iniciou_coleta and time.time() - ultimo_dado > TIMEOUT_DESCONECTADO:
                    print('\nESP desconectada. Finalizando...\n')
                    break
            except Exception:
                break

    try:
        ser.close()
    except Exception:
        pass

except Exception as e:
    print('\nERRO NA SERIAL:', e)
    sys.exit()


# ── PROCESSAMENTO ─────────────────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH, header=None, names=COLUNAS, skiprows=1)

# Eixo de tempo em segundos
df['time_s'] = df['time'] / 1000.0

# Frequência de amostragem estimada
fs = 1000.0 / df['time'].diff().mean()

# Média móvel simples de JANELA_MEDIA_MOVEL pontos (centrada)
df['Vel_media_movel'] = (
    df['Vel_ms']
    .rolling(window=JANELA_MEDIA_MOVEL, center=True, min_periods=1)
    .mean()
)

# Velocidade estimada de saída: média dos primeiros N_INICIO valores
vel_saida = df['Vel_ms'].iloc[:N_INICIO].mean()
print(f'Velocidade estimada de saída (média dos primeiros {N_INICIO} valores): '
      f'{vel_saida:.3f} m/s')


# ── PLOT ───────────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 4))
ax.plot(df['time_s'], df['Vel_media_movel'], color='steelblue', linewidth=2)
ax.set_title('Velocidade ao longo do tempo')
ax.set_xlabel('Tempo (s)')
ax.set_ylabel('Velocidade (m/s)')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()