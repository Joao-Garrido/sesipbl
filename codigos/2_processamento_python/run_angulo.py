"""
BEL Monitor - Angulo entre as 2 IMUs pelo metodo CORRETO (analise_completaPBL.py),
agora com REMOCAO DE BIAS do giroscopio.

Metodo: enquanto a carretilha esta parada (vel<0.2) no inicio, mede o bias
(offset) do giroscopio; ao comecar a mover, trava o bias e integra (gy - bias)
de cada IMU -> yaw. Angulo = |L_Yaw - R_Yaw| com passa-baixa (~2 Hz).
Le 1 WebSocket do server.py (l_* = carretilha, r_* = atleta).

Uso:
  Janela 1: SIMULAR.bat (ou INICIAR.bat com ESP)
  Janela 2: python run_angulo.py
"""
from __future__ import annotations

import json
import math
import os
import sys

try:
    from websocket import create_connection  # websocket-client
except ImportError:
    print("[ERRO] Falta a lib websocket-client. Rode: pip install websocket-client")
    sys.exit(1)


WS_URL = os.environ.get("WS_URL", "ws://localhost:8000/ws")
FATOR_GIRO = 1.0                      # giroscopio ja vem em °/s
LP_RC = 1.0 / (2 * math.pi * 2)       # passa-baixa, corte 2 Hz


def main() -> None:
    print(f"[run_angulo] conectando em {WS_URL}")
    print("[run_angulo] metodo: integracao do giroscopio Y (yaw) - bias  ->  |L_Yaw - R_Yaw| + passa-baixa")
    print("-" * 60)

    ws = create_connection(WS_URL, timeout=10)
    print("[run_angulo] conectado. Aguardando dados...")
    print("-" * 60)

    l_yaw = r_yaw = 0.0
    last_r_gy = 0.0
    last_ts = t0 = None
    angle_lp = None
    bias_l = bias_r = 0.0
    bias_sum_l = bias_sum_r = 0.0
    bias_n = 0
    bias_ready = False
    n = 0

    try:
        while True:
            raw = ws.recv()
            if not raw:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") not in ("data", "init"):
                continue

            if msg.get("type") == "data":
                rows = [msg["row"]] if msg.get("row") else []
            else:
                # 'init' = historico bufferizado (ate 300 linhas STALE). Integrar tudo
                # isso semearia t0/last_ts/bias de uma linha velha e imprimiria um angulo
                # de abertura falso. O frontend (useLocalLiveSession.ts) so usa o ultimo
                # frame; espelhamos isso: integracao comeca do primeiro frame 'data' vivo,
                # usando no maximo a ULTIMA linha do historico so pra semear o relogio.
                data = msg.get("data") or []
                rows = [data[-1]] if data else []
            for row in rows:
                if "l_gy" not in row:
                    continue
                ts = row.get("ts_device")
                if last_ts is None:
                    last_ts = t0 = ts
                    continue
                elapsed = (ts - t0) / 1000.0
                dt = max(0.001, (ts - last_ts) / 1000.0)
                last_ts = ts

                # IMU do atleta as vezes chega zerada (sem pacote ESP-NOW): segura o ultimo gy
                r_zero = row["r_ax"] == 0 and row["r_ay"] == 0 and row["r_az"] == 0
                r_gy = last_r_gy if r_zero else row["r_gy"]
                if not r_zero:
                    last_r_gy = row["r_gy"]

                vel = row.get("vel", 0.0)
                if not bias_ready and vel < 0.2 and elapsed < 2.0:
                    # parado: mede o bias do giroscopio; angulo fica em 0
                    bias_sum_l += row["l_gy"]
                    bias_sum_r += r_gy
                    bias_n += 1
                    angle_lp = 0.0
                    continue
                if not bias_ready:
                    bias_l = bias_sum_l / bias_n if bias_n else 0.0
                    bias_r = bias_sum_r / bias_n if bias_n else 0.0
                    bias_ready = True
                    print(f"[bias travado]  L: {bias_l:.2f} °/s   R: {bias_r:.2f} °/s")
                    print("-" * 60)

                # integracao discreta do giroscopio Y (sem bias) -> yaw
                l_yaw += (row["l_gy"] - bias_l) / FATOR_GIRO * dt
                r_yaw += (r_gy - bias_r) / FATOR_GIRO * dt
                angle_raw = abs(l_yaw - r_yaw)

                # passa-baixa causal (aproxima o Butterworth offline)
                alpha = dt / (LP_RC + dt)
                angle_lp = angle_raw if angle_lp is None else angle_lp + alpha * (angle_raw - angle_lp)

                n += 1
                if n % 10 == 0:  # 100 Hz -> ~10 Hz no console
                    print(f"L_Yaw: {l_yaw:7.1f}°   R_Yaw: {r_yaw:7.1f}°   |   Angulo entre IMUs: {angle_lp:6.1f}°")

    except KeyboardInterrupt:
        print("\n[run_angulo] encerrado pelo usuario.")
    finally:
        ws.close()


if __name__ == "__main__":
    main()
