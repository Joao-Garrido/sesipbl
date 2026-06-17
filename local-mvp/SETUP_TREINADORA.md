# BEL Monitor — Guia da Treinadora

Este guia é pra você usar o **dashboard completo** (o painel bonito no navegador) pra
acompanhar as corridas das atletas em tempo real, salvar tentativas e ver relatórios.

O sistema tem **2 partes** que rodam juntas:
- **Backend** (a "janela preta" do Python) — fala com a ESP e gera os dados.
- **Frontend** (o dashboard Next.js) — a tela que você usa, em `http://localhost:3001`.

As duas precisam estar ligadas ao mesmo tempo. Parece muito, mas no dia a dia é só
abrir 2 atalhos e o navegador. 🙂

## Pré-requisitos (1 única vez)

1. **Python 3.10 ou superior**
   - Download: https://www.python.org/downloads/
   - ⚠️ Na instalação, MARQUE a caixinha **"Add Python to PATH"** antes de clicar Install Now

2. **Node.js 18 ou superior (LTS)** ← isto é novo, é o que roda o dashboard
   - Download: https://nodejs.org/
   - Clica no botão verde **LTS** → Next, Next, Install

> Pra conferir que instalaram, abre o cmd e digita `python --version` e `node --version`.
> Cada um tem que responder com uma versão.

## Setup (1 única vez)

1. Descompacte o projeto em qualquer lugar (ex: Área de Trabalho).
   - ⚠️ NÃO rode de dentro do zip. Sempre extraído.
2. Instale as dependências do **Python**: entre na pasta `local-mvp` e dê duplo clique em **`INSTALAR.bat`**.
   - Se aparecer "Windows protegeu seu PC": **Mais informações → Executar assim mesmo**
   - Aguarde ~2 min.
3. Instale as dependências do **dashboard (Node)**: abra o cmd na **pasta raiz do projeto**
   (a de cima, onde estão `package.json` e a pasta `local-mvp`) e rode:
   ```cmd
   npm install
   ```
   - Demora 3-5 min na primeira vez. Pode tomar um café. ☕
4. Só se for usar a **ESP de verdade** (pula se for usar só o simulador):
   - Conecte a ESP da carretilha via USB.
   - Tecla Windows + R → digite `devmgmt.msc` → Enter → expanda **Portas (COM e LPT)** → anote o número (ex: `COM4`).
   - Abra `local-mvp\.env` no Bloco de Notas, troque `PORTA_SERIAL=COM3` pelo número anotado, salve e feche.

## Uso diário

Você vai abrir **2 janelas** + o navegador.

### 1) Liga o backend (a janela preta)

Na pasta `local-mvp`:
- **Com a ESP de verdade**: duplo clique em **`INICIAR.bat`**
  - (Conecte a ESP da carretilha; a do atleta liga separado, na bateria. Feche o Arduino IDE se estiver aberto.)
- **Sem ESP, modo demonstração**: duplo clique em **`SIMULAR.bat`** (gera uma corrida de 100 m fake)

Deixe essa janela preta aberta. Não feche.

### 2) Liga o dashboard (o frontend)

Abra o cmd na **pasta raiz do projeto** e rode:
```cmd
npm run dev
```
Espera ~10s até aparecer `http://localhost:3001`. Deixe rodando também.

### 3) Abre no navegador

Vá em **http://localhost:3001/inicio** (visão geral) ou **http://localhost:3001/live** (pra capturar uma corrida).

> Se o Windows pedir permissão de Firewall, clique **Permitir acesso** (Redes privadas).

## Fluxo de uma corrida (passo a passo)

1. **Cadastre a atleta** em **http://localhost:3001/atletas** (se ainda não estiver lá).
2. Vá em **http://localhost:3001/live** e clique em **"Iniciar Tentativa"**.
3. A atleta **corre**. Não precisa apertar nada pra parar.
4. Ao chegar nos **100 m, a tentativa encerra sozinha** e **salva sozinha**.
5. Veja o resultado em **http://localhost:3001/relatorio** e a visão geral em **http://localhost:3001/inicio**.

No simulador, a corrida completa de 100 m demora ~13 segundos.

## O que vai aparecer no dashboard

- **Velocidade ao vivo** (m/s)
- **Deslocamento** acumulado (m) — chega em 100 m e encerra automático
- **Ângulo entre as IMUs** (mostrador/gauge)
- **Métricas por fase**:
  - Saída (0–10 m)
  - Aceleração (10–30 m)
  - Velocidade máxima (30–60 m)
  - Manutenção (60–100 m)
- **Pulsos do encoder** e **RPM**
- **Tempos**: t10m e t100m
- **Recordes** da atleta
- **Backup CSV** automático em `local-mvp/logs/log_YYYYMMDD_HHMMSS.csv`

## Indicador online/offline

No dashboard (canto superior):
- 🟢 **conectado** = comunicação com o backend ok
- 🟢 **recebendo** = chegando dados da ESP (ou do simulador)
- 🔴 **sem dados** = nada chegando — veja o checklist abaixo

## Se não funcionar

| Sintoma | Solução |
|---|---|
| "could not open port COMx" | Arduino IDE aberto. Feche. Ou COM errada no `.env`. |
| "Python não foi encontrado" | Reinstala Python marcando "Add to PATH" |
| `npm` não reconhecido | Reinstala Node.js (LTS) |
| Dashboard 🔴 sem dados | A janela preta (backend) não está rodando, ou a ESP não está plugada/ligada. Confira COM no `.env`. |
| Dashboard não abre em :3001 | A janela do `npm run dev` não está rodando, ou ainda está carregando (espere ~10s). |
| Tela toda travada | Ctrl+C nas duas janelas, feche tudo e comece de novo |
| Firewall pediu permissão | Clica "Permitir acesso" (Redes privadas) |

> 🔧 **Diagnóstico avançado (opcional):** o backend também serve uma página crua de
> telemetria em `http://localhost:8000`. Ela **não** é o painel da treinadora — serve só
> pra checar rapidamente se a ESP está mandando dados. O seu painel de uso é sempre o
> `http://localhost:3001`.

## Suporte

Contato do suporte: _(preencher)_
