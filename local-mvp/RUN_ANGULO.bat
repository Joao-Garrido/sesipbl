@echo off
chcp 65001 >nul
title BEL Monitor - ANGULO (PBL7_Carretilha)
color 0D

if not exist .venv (
    echo Execute INSTALAR.bat primeiro.
    pause & exit /b 1
)

call .venv\Scripts\activate.bat

echo ============================================================
echo  CALCULO DE ANGULO ENTRE IMUs (PBL7_Carretilha)
echo  Usa as funcoes ORIGINAIS de angulo_imus.py
echo  Le dados via WebSocket do server.py
echo ============================================================
echo.
echo Certifique-se que SIMULAR.bat ou INICIAR.bat esta rodando!
echo.

python run_angulo.py
pause
