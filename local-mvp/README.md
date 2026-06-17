# BEL Monitor — MVP Local

Tudo num PC. Zero nuvem. ESP → Python → Browser local.

```
┌──────────┐  USB    ┌──────────────────────┐  HTTP/WS  ┌─────────┐
│  ESP32   ├────────►│  server.py           ├──────────►│ Browser │
└──────────┘ Serial  │  (FastAPI+WS+Serial) │           │ Chart.js│
                     └──────────┬───────────┘           └─────────┘
                                │
                                ▼
                          logs/log_*.csv
```

## Setup (1ª vez)

1. Instala Python 3.10+ (https://python.org/downloads — marca "Add to PATH").
2. Duplo clique `INSTALAR.bat`.
3. Se ESP não estiver em `COM3`, abre `.env` e ajusta.

## Uso

1. ESP plugada via USB. Arduino IDE **fechado**.
2. Duplo clique `INICIAR.bat`.
3. Navegador abre em http://localhost:8000.
4. Pra parar: Ctrl+C no terminal ou fecha janela.

## O que tem no dashboard

- **KPIs ao vivo**: velocidade, pulsos, |Accel L|, |Gyro L|, |Accel R|, taxa de amostragem.
- **6 gráficos**: velocidade, pulsos, accel L, gyro L, accel R, gyro R.
- **Status**: dot verde = WebSocket conectado / dados chegando.
- **Botões**: limpar gráficos, pausar (gráfico congela mas CSV continua salvando).

## Backup CSV

Cada execução cria um arquivo em `logs/log_YYYYMMDD_HHMMSS.csv` com todas as amostras. Independe de internet ou browser.

## Acessar de outro PC na mesma rede

Servidor escuta em `0.0.0.0:8000`. Pra acessar de celular/laptop na mesma Wi-Fi:

1. Descobre IP local do PC servidor: `ipconfig` → `IPv4`. Ex: `192.168.0.42`.
2. No outro dispositivo: `http://192.168.0.42:8000`.
3. Se bloquear, libera porta 8000 no Firewall do Windows.

## Problemas

| Sintoma | Fix |
|---|---|
| `could not open port COM3` | Arduino IDE aberto. Fecha. |
| Porta serial errada | Gerenciador de Dispositivos → Portas (COM e LPT). Edita `.env`. |
| Dashboard sem dados | Confere terminal — se `[SERIAL] conectado` apareceu. Se não, ESP/porta errada. |
| `address already in use` | Outra coisa usa porta 8000. Muda `HTTP_PORT` no `.env`. |
| Python não achado | Reinstala marcando "Add to PATH". |

## Próximo passo (depois)

Adiciona cloud (Supabase + Vercel) pra ver de qualquer lugar. Código pronto em `../bridge` e `../web`.
