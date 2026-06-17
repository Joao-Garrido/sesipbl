import pandas as pd
import matplotlib.pyplot as plt
import serial
import time
import sys
from scipy.signal import butter, filtfilt, find_peaks

CSV_PATH         = 'bruto_Emily_2026-06-17'
COLUNAS          = ['time', 'Ax', 'Angulo_graus', 'Pulsos', 'Vel_ms']
PORTA_SERIAL     = 'COM4'
BAUD_RATE        = 115200
TIMEOUT_DESCONECTADO = 3


def passa_baixa(sinal, freq_corte, fs):
    nyq = fs / 2
    b, a = butter(2, freq_corte / nyq, btype='low')
    return filtfilt(b, a, sinal)


# ── COLETA SERIAL ─────────────────────────────────────────────────────────────
print(f'Conectando na {PORTA_SERIAL}...')
ser = None

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

time_s = df['time'].values / 1000.0
fs     = 1000.0 / df['time'].diff().mean()

df['Angulo_filtrado'] = passa_baixa(df['Angulo_graus'].values, freq_corte=5, fs=fs)
sinal = df['Angulo_filtrado'].values

# Todos os picos; seleciona o de maior amplitude
# Sobre o find peaks: picos, propriedades = find_peaks(sinal, height, threshold, distance, prominence, width, plateau_size)
# O retorno é um array de indices onde há picos e um dicionário com as infos solicitadas nos argumentos 
# Nesse caso, '_' faz ele descartar as ppds -> pega todos os picos e depois eu peco o maior com 'argmax'

picos, _ = find_peaks(sinal)
if len(picos) == 0:
    print('Nenhum pico encontrado no sinal filtrado.')
    maior_idx  = None
    maior_y    = None
    maior_t    = None
else:
    maior_idx = picos[sinal[picos].argmax()]
    maior_y   = sinal[maior_idx]
    maior_t   = time_s[maior_idx]
    print(f'O ângulo de saída é {maior_y:.2f}°')


# ── PLOT ───────────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 4))

ax.plot(time_s, sinal, color='purple', linewidth=1.5)

ax.set_title('Ângulo ao longo do tempo')
ax.set_xlabel('Tempo (s)')
ax.set_ylabel('Ângulo (°)')
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.show()