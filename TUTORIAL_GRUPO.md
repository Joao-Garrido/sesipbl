# 🚀 BEL Monitor — Tutorial Rápido (Grupo)

Tempo total: ~15 min na primeira vez. Depois é 2 cliques.

---

## ✅ Pré-requisitos (uma vez só)

Instala estes 2 antes de tudo:

### 1. Python 3.10+
- Download: https://www.python.org/downloads/
- ⚠️ Na 1ª tela do instalador, **MARQUE a caixinha "Add Python to PATH"** antes de clicar Install Now

### 2. Node.js 18+ (LTS)
- Download: https://nodejs.org/
- Clica no botão **LTS** (verde)
- Next, Next, Install

**Confere se instalou** (abre cmd e roda):
```cmd
python --version
node --version
```
Tem que retornar uma versão pra cada. Se "não reconhecido", reinstala marcando PATH.

---

## 📦 Passo 1 — Extrair o zip

1. Salva `bel-grupo.zip` na Área de Trabalho
2. Botão direito → **Extrair Tudo** → Extrair
3. Vai criar uma pasta tipo `PBL 7 semestre`
4. ⚠️ NÃO rode nada de dentro do zip. Sempre extraído.

---

## 🐍 Passo 2 — Instalar Python deps

Abre **cmd** (Win+R → `cmd` → Enter):

```cmd
cd "%USERPROFILE%\Desktop\PBL 7 semestre\local-mvp"
INSTALAR.bat
```

> Se aparecer "Windows protegeu seu PC": **Mais informações → Executar assim mesmo**

Aguarda ~2 min. No final deve aparecer `INSTALACAO OK`.

---

## 📦 Passo 3 — Instalar Node deps

No **mesmo cmd**, volta pra pasta raiz:

```cmd
cd ..
npm install
```

⏱️ Demora **3-5 min** (instala ~400 MB de libs). Café.

No final mostra algo tipo:
```
added 412 packages, audited 413 packages in 3m
```

---

## ⚙️ Passo 4 — Configurar (opcional)

Se quiser usar **ESP real** plugada:

1. Plug a ESP da carretilha no USB
2. Tecla Windows+R → digite `devmgmt.msc` → Enter
3. Expande **Portas (COM e LPT)**
4. Anota o número COM. Ex: `COM4`
5. Abre `local-mvp\.env` no Bloco de Notas
6. Troca `PORTA_SERIAL=COM3` pelo número anotado
7. Salva (Ctrl+S) e fecha

Se NÃO tem ESP (vai usar simulador), pula este passo.

---

## ▶️ Passo 5 — Rodar

Precisa de **2 janelas cmd abertas ao mesmo tempo**.

### Janela 1 — backend Python

```cmd
cd "%USERPROFILE%\Desktop\PBL 7 semestre\local-mvp"
```

**Sem ESP (simulador)**:
```cmd
SIMULAR.bat
```

**Com ESP real**:
```cmd
INICIAR.bat
```

Vai aparecer:
```
============================================================
 BEL MONITOR - MVP Local
============================================================
 Dashboard:     http://localhost:8000
============================================================
```

⚠️ **Não fecha essa janela**. Deixa rodando.

> Se o Windows pedir permissão de Firewall, clica **Permitir acesso** (Redes privadas).

### Janela 2 — frontend Next.js

Abre **outra cmd**:

```cmd
cd "%USERPROFILE%\Desktop\PBL 7 semestre"
npm run dev
```

Aguarda ~10s. Vai aparecer:
```
   ▲ Next.js 15.x.x
   - Local:        http://localhost:3001
   ✓ Ready in 8.5s
```

Também deixa rodando.

---

## 🌐 Passo 6 — Abrir dashboard

No navegador (Chrome/Edge/Firefox):

```
http://localhost:3001/live
```

Clica no botão vermelho **"Iniciar Tentativa"**.

### O que deve aparecer

- **Badge azul** no topo direito: `Local WS · server.py`
- **Hardware**: Encoder OK, IMU (MPU6050) OK, Sinal —, Bateria —
- **KPIs ao vivo**: Velocidade, Aceleração, Ângulo
- **Gráficos** mexendo: velocidade × aceleração, Vx/Vy
- **Métricas por Fase**: Saída (0-10m), Aceleração (10-30m), Vel Máx (30-60m), Manutenção (60-100m) — preenchendo conforme passa
- **Auto-stop em 100m**: tentativa encerra sozinha

No simulador, a corrida completa de 100m demora ~13 segundos.

---

## 🐍 (Opcional) Janelas 3+ — clientes Python adicionais

Quer ver o **algoritmo Python original** do PBL7_Carretilha rodando contra os dados ao vivo?

```cmd
cd "%USERPROFILE%\Desktop\PBL 7 semestre\local-mvp"
RUN_ANGULO.bat
```

Console imprime ângulo entre as 2 IMUs em tempo real.

Ou matplotlib live da velocidade:
```cmd
RUN_PLOT.bat
```

---

## ⏹️ Como parar

1. **Janela 2 (Next.js)**: clica nela e aperta Ctrl+C → Y
2. **Janela 1 (Python)**: clica nela e aperta Ctrl+C
3. Fecha as janelas
4. Pode fechar o navegador

---

## 🔄 Próximas vezes

Já tudo instalado. Só:

```cmd
:: Janela 1
cd "%USERPROFILE%\Desktop\PBL 7 semestre\local-mvp"
SIMULAR.bat

:: Janela 2
cd "%USERPROFILE%\Desktop\PBL 7 semestre"
npm run dev

:: Browser: http://localhost:3001/live
```

---

## ❌ Problemas comuns

| Sintoma | Solução |
|---|---|
| `python` não reconhecido | Reinstala Python marcando "Add to PATH" |
| `npm` não reconhecido | Reinstala Node.js |
| INSTALAR.bat: SmartScreen bloqueia | Mais informações → Executar assim mesmo |
| `could not open port COMx` | Arduino IDE aberto. Fecha. Ou COM errada no .env |
| Dashboard 🔴 sem dados | Janela 1 (Python) não tá rodando |
| `Address already in use` :3001 | Outro processo usando porta 3001. Mata ou muda porta no package.json |
| `Address already in use` :8000 | Outro processo. Muda `HTTP_PORT` em `local-mvp\.env` |
| npm install falha | Versão Node antiga. Instala v18+ |
| Dashboard mostra "Modo Demo (sem Firebase)" e não "Local WS" | `.env.local` não existe ou WS URL errada. Cria/edita `.env.local` na raiz com: `NEXT_PUBLIC_LOCAL_WS_URL=ws://localhost:8000/ws` |

---

## 📁 O que tem no projeto

```
PBL 7 semestre/
├── local-mvp/              ← backend Python + dashboard HTML simples
│   ├── server.py
│   ├── SIMULAR.bat / INICIAR.bat / INSTALAR.bat
│   ├── run_angulo.py / run_plot.py
│   └── static/index.html
├── src/                    ← frontend Next.js (dashboard completo)
│   ├── app/(dashboard)/live/   ← tela ao vivo
│   └── features/live/          ← gauges, charts, KPIs
├── PBL7_Carretilha/        ← sketches ESP + scripts Python originais
│   ├── ESP_Carretilha/         ← sketch Arduino IDE pra carretilha
│   ├── ESP_Atleta/             ← sketch Arduino IDE pra atleta
│   ├── angulo_imus.py          ← cálculo de ângulo original
│   └── plot_encoder.py         ← matplotlib original
├── package.json
└── .env.local              ← config do frontend (NEXT_PUBLIC_LOCAL_WS_URL)
```

---

## 🆘 Suporte

Se travar em algum passo, manda print da tela completa pra:
**[NOME / WHATSAPP]**

E descreve em qual passo do tutorial estava.
