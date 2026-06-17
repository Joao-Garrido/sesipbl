@echo off
chcp 65001 >nul
title BEL Monitor MVP - Instalacao
color 0A

echo ============================================================
echo  BEL MONITOR MVP - Instalacao
echo ============================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado. Instale em python.org/downloads
    echo IMPORTANTE: marque "Add Python to PATH"
    pause & exit /b 1
)

echo [OK] Python encontrado.
python --version
echo.

if not exist .venv (
    echo Criando venv...
    python -m venv .venv
)

echo Instalando dependencias...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

if errorlevel 1 (
    echo [ERRO] Falha na instalacao.
    pause & exit /b 1
)

if not exist .env (
    copy .env.example .env >nul
    echo.
    echo Arquivo .env criado. Edita se PORTA_SERIAL nao for COM3.
)

echo.
echo ============================================================
echo  INSTALACAO OK. Rode INICIAR.bat
echo ============================================================
pause
