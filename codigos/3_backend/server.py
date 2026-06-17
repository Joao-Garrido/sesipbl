"""
BEL Monitor - Servidor local MVP

Le ESP via Serial, broadcasta via WebSocket pra browser local,
e salva CSV de backup. Tudo num PC so.

Uso:
  pip install -r requirements.txt
  python server.py
  abre http://localhost:8000
"""

from __future__ import annotations

import asyncio
import csv
import json
import math
import os
import random
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import serial
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# ----------------------------------------------------------------
# Config
# ----------------------------------------------------------------
load_dotenv()
PORTA_SERIAL = os.environ.get("PORTA_SERIAL", "COM3")
BAUD         = int(os.environ.get("BAUD", "115200"))
HTTP_PORT    = int(os.environ.get("HTTP_PORT", "8000"))
LOG_DIR      = Path(os.environ.get("LOG_DIR", "logs"))
DATA_DIR     = Path(os.environ.get("DATA_DIR", "data"))  # historico persistente (atletas + tentativas)
SIMULATE     = os.environ.get("SIMULATE", "0") == "1"

COLS = [
    "ts_device",
    "l_ax", "l_ay", "l_az", "l_gx", "l_gy", "l_gz",
    "r_ax", "r_ay", "r_az", "r_gx", "r_gy", "r_gz",
    "pulsos", "vel",
]
INT_COLS = {"ts_device", "pulsos"}

# ----------------------------------------------------------------
# Estado
# ----------------------------------------------------------------
clients: set[WebSocket] = set()
ultima_amostra: dict | None = None
total_recv = 0
total_drop = 0
serial_ok = False

# Buffer pra historico (300 amostras)
historico: list[dict] = []
HIST_MAX = 300

# ----------------------------------------------------------------
# Util
# ----------------------------------------------------------------
def parse(linha: str) -> dict | None:
    p = linha.split(",")
    if len(p) != len(COLS):
        return None
    row: dict = {}
    for k, v in zip(COLS, p):
        try:
            row[k] = int(v) if k in INT_COLS else float(v.strip())
        except (ValueError, AttributeError):
            return None
    row["ts_recv"] = int(time.time() * 1000)
    return row


def abrir_csv():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    nome = LOG_DIR / f"log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    f = open(nome, "w", newline="", encoding="utf-8")
    w = csv.writer(f)
    w.writerow(COLS)
    print(f"[CSV] {nome}")
    return f, w


# ----------------------------------------------------------------
# Serial reader (thread separada)
# ----------------------------------------------------------------
def serial_loop(loop: asyncio.AbstractEventLoop) -> None:
    global ultima_amostra, total_recv, total_drop, serial_ok

    csv_f, csv_w = abrir_csv()

    while True:
        try:
            ser = serial.Serial(PORTA_SERIAL, BAUD, timeout=2)
            time.sleep(2)
            ser.reset_input_buffer()
            serial_ok = True
            print(f"[SERIAL] conectado: {PORTA_SERIAL} @ {BAUD}")

            while True:
                raw = ser.readline()
                if not raw:
                    continue
                linha = raw.decode(errors="ignore").strip()
                if not linha or linha.startswith("Time"):
                    continue
                row = parse(linha)
                if row is None:
                    total_drop += 1
                    # Linha malformada / numero de colunas errado. Sem isso aqui o coach
                    # so ve "sem dados" e nao sabe que e cabo/baud/firmware.
                    if total_drop % 100 == 0:
                        print(f"[serial] {total_drop} linhas descartadas "
                              f"(verifique cabo/baud/firmware 15 colunas)")
                    # Muitos descartes e NENHUMA linha valida = assinatura classica de
                    # firmware/contagem de colunas errados (ex: sketch de 9 colunas).
                    if total_recv == 0 and total_drop in (50, 200, 500):
                        print(f"[serial] ATENCAO: {total_drop} linhas recebidas e NENHUMA valida. "
                              f"Provavel firmware/baud errado — esperado 15 colunas "
                              f"({','.join(COLS)}).")
                    continue

                ultima_amostra = row
                total_recv += 1
                historico.append(row)
                if len(historico) > HIST_MAX:
                    historico.pop(0)

                csv_w.writerow([row[c] for c in COLS])
                if total_recv % 50 == 0:
                    csv_f.flush()

                # broadcast async (thread-safe)
                asyncio.run_coroutine_threadsafe(broadcast(row), loop)

        except serial.SerialException as e:
            serial_ok = False
            print(f"[SERIAL] erro: {e}. retry 3s")
            time.sleep(3)
        except Exception as e:
            serial_ok = False
            print(f"[SERIAL] inesperado: {e}")
            time.sleep(3)


# ----------------------------------------------------------------
# SIMULADOR: gera CSV identico ao que a ESP enviaria
# Cinematica: 0 -> aceleracao rampa -> velocidade plateau ~5 m/s ->
#             oscilacao + ruido. Encoder integra a velocidade real.
# ----------------------------------------------------------------
def simulator_loop(loop: asyncio.AbstractEventLoop) -> None:
    global ultima_amostra, total_recv, serial_ok

    csv_f, csv_w = abrir_csv()
    serial_ok = True
    print("[SIMULADOR] ativo (SIMULATE=1). Frequencia: 100 Hz")
    print("[SIMULADOR] Gerando dados sinteticos no formato exato da ESP")

    # parametros do encoder (iguais ao sketch)
    PPR_X4 = 2400
    DIAMETRO_M = 0.05
    PERIM = math.pi * DIAMETRO_M

    t0 = time.monotonic()
    last_loop = t0
    pulsos_acum = 0.0

    while True:
        agora = time.monotonic()
        elapsed = agora - t0
        dt = agora - last_loop
        last_loop = agora

        # Velocidade simulada: perfil de 100m
        #   0-2s: rampa 0->8 m/s (saida + aceleracao)
        #   2-15s: plateau ~8 m/s com pequena oscilacao (vel max + manutencao)
        #   15s+: leve desacel
        # Em ~13s acumulamos ~100m de deslocamento -> dashboard auto-stop.
        # Apos 25s o simulador reseta pra rodar outro ciclo.
        if elapsed < 2.0:
            vel = 8.0 * (1.0 - math.exp(-elapsed * 1.4))
        elif elapsed < 15.0:
            vel = 8.0 + 0.4 * math.sin(elapsed * 1.2) + random.uniform(-0.08, 0.08)
        elif elapsed < 25.0:
            vel = max(0.0, 8.0 - (elapsed - 15.0) * 0.5)
        else:
            t0 = agora  # reseta ciclo
            pulsos_acum = 0.0
            vel = 0.0

        # Encoder integra velocidade
        pulsos_acum += (vel / PERIM) * PPR_X4 * dt
        pulsos = int(pulsos_acum)

        # IMU local (carretilha): gravidade + bounce do passo + ruido
        # Aceleracao em "g" (igual sketch que divide por 4096 com FS=8g)
        # Bounce proporcional a velocidade — quanto mais rapido, mais bate.
        # Cadencia ~3 Hz (passos por segundo) em regime.
        stride_hz = 2.5 + vel * 0.15
        bounce_amp = 0.25 + vel * 0.05
        l_az = 1.0 + bounce_amp * math.sin(elapsed * stride_hz * 2 * math.pi) + random.uniform(-0.03, 0.03)
        l_ax = 0.20 * math.sin(elapsed * 5) + random.uniform(-0.04, 0.04)
        l_ay = 0.15 * math.cos(elapsed * 5) + random.uniform(-0.04, 0.04)
        # Gyro em °/s (sketch divide por 131)
        l_gx = 8.0 * math.sin(elapsed * 3) + random.uniform(-0.5, 0.5)
        l_gy = 5.0 * math.cos(elapsed * 4) + random.uniform(-0.5, 0.5)
        l_gz = 3.0 * math.sin(elapsed * 2) + random.uniform(-0.5, 0.5)

        # IMU remoto (atleta) com pequeno offset (simula ESP-NOW)
        r_ax = l_ax * 0.7 + random.uniform(-0.05, 0.05)
        r_ay = l_ay * 0.7 + random.uniform(-0.05, 0.05)
        r_az = l_az + random.uniform(-0.03, 0.03)
        r_gx = l_gx * 0.6 + random.uniform(-0.5, 0.5)
        r_gy = l_gy * 0.6 + random.uniform(-0.5, 0.5)
        r_gz = l_gz * 0.6 + random.uniform(-0.5, 0.5)

        row = {
            "ts_device": int(elapsed * 1000),
            "l_ax": round(l_ax, 4), "l_ay": round(l_ay, 4), "l_az": round(l_az, 4),
            "l_gx": round(l_gx, 4), "l_gy": round(l_gy, 4), "l_gz": round(l_gz, 4),
            "r_ax": round(r_ax, 4), "r_ay": round(r_ay, 4), "r_az": round(r_az, 4),
            "r_gx": round(r_gx, 4), "r_gy": round(r_gy, 4), "r_gz": round(r_gz, 4),
            "pulsos": pulsos,
            "vel": round(vel, 3),
            "ts_recv": int(time.time() * 1000),
        }

        ultima_amostra = row
        total_recv += 1
        historico.append(row)
        if len(historico) > HIST_MAX:
            historico.pop(0)

        csv_w.writerow([row[c] for c in COLS])
        if total_recv % 50 == 0:
            csv_f.flush()

        asyncio.run_coroutine_threadsafe(broadcast(row), loop)
        time.sleep(0.01)  # 100 Hz


# ----------------------------------------------------------------
# WebSocket broadcast
# ----------------------------------------------------------------
async def broadcast(row: dict) -> None:
    msg = json.dumps({"type": "data", "row": row})
    dead = []
    for ws in clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)


# ----------------------------------------------------------------
# FastAPI
# ----------------------------------------------------------------
app = FastAPI(title="BEL Monitor MVP")

# CORS aberto pra Next.js (porta 3001) e qualquer cliente local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/status")
async def status():
    return {
        "serial_ok": serial_ok,
        "porta": PORTA_SERIAL,
        "total_recv": total_recv,
        "total_drop": total_drop,
        "ultima": ultima_amostra,
        "historico_len": len(historico),
    }


@app.get("/api/historico")
async def get_historico():
    return {"data": historico}


# ----------------------------------------------------------------
# Persistencia em disco: atletas + tentativas (todo o historico).
# O frontend sincroniza aqui — fica salvo em data/store.json, sobrevive a
# trocar/limpar o navegador e pode ser copiado pra backup.
# ----------------------------------------------------------------
STORE_FILE = DATA_DIR / "store.json"


@app.get("/api/store")
async def get_store():
    if STORE_FILE.exists():
        try:
            return json.loads(STORE_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            # Arquivo existe mas esta corrompido/ilegivel. NAO servir um store vazio:
            # o frontend gravaria esse vazio de volta e apagaria tudo. Move o arquivo
            # ruim pro lado pra inspecao e avisa alto no console.
            corrupt = DATA_DIR / "store.corrupt.json"
            try:
                os.replace(STORE_FILE, corrupt)
                print(f"[STORE] ATENCAO: {STORE_FILE} ilegivel ({e}). Movido para {corrupt}.")
                print("[STORE] Verifique esse arquivo antes de coletar novas tentativas.")
            except Exception as e2:
                print(f"[STORE] ATENCAO: {STORE_FILE} ilegivel ({e}) e nao consegui move-lo: {e2}")
    # So chega aqui se o arquivo genuinamente nao existe ainda (ou foi movido acima).
    return {"athletes": [], "attempts": []}


@app.put("/api/store")
async def put_store(payload: dict):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, ensure_ascii=False, indent=2)
    # Escrita atomica: grava num temp no MESMO diretorio e troca com os.replace
    # (atomico no mesmo filesystem). Um kill/queda de energia no meio nunca deixa
    # store.json truncado — ou fica o arquivo antigo intacto, ou o novo completo.
    tmp = DATA_DIR / "store.json.tmp"
    tmp.write_text(data, encoding="utf-8")
    # mantem um .bak do ultimo arquivo bom antes de substituir
    if STORE_FILE.exists():
        try:
            os.replace(STORE_FILE, DATA_DIR / "store.bak.json")
        except Exception as e:
            print(f"[STORE] aviso: nao consegui criar backup .bak: {e}")
    os.replace(tmp, STORE_FILE)
    n_at = len(payload.get("athletes", []))
    n_te = len(payload.get("attempts", []))
    print(f"[STORE] salvo: {n_at} atletas, {n_te} tentativas -> {STORE_FILE}")
    return {"ok": True}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    # manda historico inicial
    try:
        await ws.send_text(json.dumps({"type": "init", "data": historico}))
        while True:
            await ws.receive_text()  # mantem conexao
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)


# servir arquivos estaticos (caso adicione mais depois)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ----------------------------------------------------------------
# Main
# ----------------------------------------------------------------
def main() -> None:
    modo = "SIMULADOR" if SIMULATE else f"SERIAL ({PORTA_SERIAL})"
    print("=" * 60)
    print(" BEL MONITOR - MVP Local")
    print("=" * 60)
    print(f" Modo:          {modo}")
    print(f" Dashboard:     http://localhost:{HTTP_PORT}")
    print(f" CSV em:        {LOG_DIR.resolve()}")
    if SIMULATE:
        print(" >>> SIMULADOR ATIVO — sem ESP, dados sinteticos a 100 Hz <<<")
    print("=" * 60)
    print()

    loop = asyncio.new_event_loop()

    # escolhe fonte de dados: simulador ou serial real
    target = simulator_loop if SIMULATE else serial_loop
    threading.Thread(target=target, args=(loop,), daemon=True).start()

    config = uvicorn.Config(app, host="0.0.0.0", port=HTTP_PORT, loop="asyncio", log_level="warning")
    server = uvicorn.Server(config)
    loop.run_until_complete(server.serve())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[FIM]")
        sys.exit(0)
