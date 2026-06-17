import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.signal import butter, filtfilt
import serial
import time
import os
import sys

# ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────

CSV_PATH = 'dados_coleta.csv'

COLUNAS = [
    'time',
    'L_Ax', 'L_Ay', 'L_Az', 'L_Gx', 'L_Gy', 'L_Gz',
    'R_Ax', 'R_Ay', 'R_Az', 'R_Gx', 'R_Gy', 'R_Gz',
    'Pulsos', 'Vel_ms'
]

PORTA_SERIAL = 'COM4'
BAUD_RATE = 115200
TIMEOUT_DESCONECTADO = 3


FATOR_GIRO = 1.0 

# ── COLETA SERIAL ─────────────────────────────────────────────────────────────

print(f'Conectando na {PORTA_SERIAL}...')
ser = None

try:
    ser = serial.Serial(PORTA_SERIAL, BAUD_RATE, timeout=1)
    time.sleep(2)
    ser.reset_input_buffer()

    print('ESP conectada.')
    print('Aguardando dados...')
    print('Desconecte a alimentação da ESP para encerrar.\n')

    ultimo_dado = time.time()
    iniciou_coleta = False

    with open(CSV_PATH, 'w', encoding='utf-8') as arquivo_csv:
        while True:
            try:
                if ser.in_waiting > 0:
                    linha_serial = ser.readline().decode('utf-8', errors='ignore').strip()
                    if linha_serial:
                        print(linha_serial)
                        arquivo_csv.write(linha_serial + '\n')
                        arquivo_csv.flush()
                        ultimo_dado = time.time()
                        iniciou_coleta = True

                if iniciou_coleta:
                    tempo_sem_dados = time.time() - ultimo_dado
                    if tempo_sem_dados > TIMEOUT_DESCONECTADO:
                        print('\nESP desconectada. Finalizando coleta...\n')
                        break
            except Exception:
                print('\nESP desconectada. Finalizando coleta...\n')
                break

    try:
        ser.close()
    except:
        pass

except Exception as e:
    print('\nERRO NA SERIAL:', e)
    print('\nVerifique:')
    print(f'- se a {PORTA_SERIAL} está correta')
    print('- se o Serial Monitor está fechado')
    print('- se a ESP está conectada')
    try:
        if ser is not None:
            ser.close()
    except:
        pass
    sys.exit()

# ── LEITURA CSV ───────────────────────────────────────────────────────────────

try:
    df = pd.read_csv(CSV_PATH, header=None, names=COLUNAS)
except Exception as e:
    print('\nErro lendo CSV:', e)
    sys.exit()

print(f'Linhas carregadas: {len(df)}')

# ── LIMPEZA DE DADOS (INTERPOLAÇÃO) ───────────────────────────────────────────

# Identifica as colunas da IMU direita e preenche os "zeros falsos"
cols_right = ['R_Ax', 'R_Ay', 'R_Az', 'R_Gx', 'R_Gy', 'R_Gz']
# Substitui linhas onde todos os valores da direita são 0 por NaN
df.loc[(df[cols_right] == 0).all(axis=1), cols_right] = np.nan
# Interpola para tapar os buracos
df[cols_right] = df[cols_right].interpolate(method='linear')

# Preenche possíveis NaNs no início/fim caso a primeira linha seja zero
df = df.bfill().ffill()


# ── FUNÇÕES ───────────────────────────────────────────────────────────────────
def passa_baixa(sinal, freq_corte, fs):
    nyq = fs / 2
    freq_norm = freq_corte / nyq
    b, a = butter(2, freq_norm, btype='low')
    return filtfilt(b, a, sinal)

# ── PROCESSAMENTO (CÁLCULO DO YAW COM GIROSCÓPIO) ─────────────────────────────
# 1. Calcular o dt (variação de tempo em segundos)
df['time_sec'] = df['time'] / 1000.0
dt = df['time_sec'].diff()
dt = dt.fillna(dt.mean()) # Preenche o primeiro dt vazio com a média

# 2. Converter valores do giroscópio (eixo Y) se necessário
df['L_Gy_deg'] = df['L_Gy'] / FATOR_GIRO
df['R_Gy_deg'] = df['R_Gy'] / FATOR_GIRO

# 3. Integração no tempo discreto para achar o ângulo (Yaw)
# Yaw = Somatório(Velocidade Angular * dt)
df['L_Yaw'] = (df['L_Gy_deg'] * dt).cumsum()
df['R_Yaw'] = (df['R_Gy_deg'] * dt).cumsum()

# 4. Ângulo entre as IMUs no plano horizontal
df['angulo_bruto'] = np.abs(df['L_Yaw'] - df['R_Yaw'])

# 5. Aplicar o filtro passa-baixa (estimando fs=128Hz pela sua lógica anterior)
df['angulo_entre_imus'] = passa_baixa(df['angulo_bruto'].values, freq_corte=2, fs=128)

df[['time', 'angulo_entre_imus']].to_csv('angulos.csv', index=False)

# ── SEPARAÇÃO DE DADOS ────────────────────────────────────────────────────────

t0 = df['time'].iloc[0]

# Nota: t0 + 1000 representa 1 segundo. Se quiser 2 segundos, mude para 2000.
df_2s = df[df['time'] <= t0 + 1000]
df_resto = df[df['time'] > t0 + 1000]

# ── PLOTS ─────────────────────────────────────────────────────────────────────

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 4), sharex=True)

# Ângulo
ax1.plot(df_2s['time'].values, df_2s['angulo_entre_imus'].values, color='purple', label='Saída')
ax1.plot(df_resto['time'].values, df_resto['angulo_entre_imus'].values, color='hotpink', label='Restante')
ax1.set_title('Ângulo entre IMUs')
ax1.set_ylabel('Ângulo (°)')
ax1.set_xlabel('Tempo (ms)')
ax1.legend()
ax1.grid(True)

# Velocidade
ax2.plot(df_2s['time'].values, df_2s['Vel_ms'].values, color='purple')
ax2.plot(df_resto['time'].values, df_resto['Vel_ms'].values, color='hotpink')
ax2.set_title('Velocidade (encoder)')
ax2.set_ylabel('Velocidade (m/s)')
ax2.set_xlabel('Tempo (ms)')
ax2.grid(True)

plt.tight_layout()
plt.savefig('analise_completa.png', dpi=150)
plt.show()