@echo off
chcp 65001 >nul
title BEL Monitor MVP - SIMULADOR
color 0E

if not exist .venv (
    echo Execute INSTALAR.bat primeiro.
    pause & exit /b 1
)

call .venv\Scripts\activate.bat

echo ============================================================
echo  MODO SIMULADOR
echo  Gera dados sinteticos identicos ao que a ESP enviaria.
echo  Use isso para testar SEM hardware conectado.
echo ============================================================

set SIMULATE=1
python server.py
pause
