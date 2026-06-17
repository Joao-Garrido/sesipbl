@echo off
chcp 65001 >nul
title BEL Monitor MVP
color 0B

if not exist .venv (
    echo Execute INSTALAR.bat primeiro.
    pause & exit /b 1
)

call .venv\Scripts\activate.bat

echo.
echo ============================================================
echo  Backend iniciando. Deixe esta janela aberta.
echo.
echo  Para usar o painel da treinadora, abra OUTRA janela cmd
echo  na pasta raiz do projeto e rode:
echo.
echo      npm run dev
echo.
echo  Depois abra no navegador:  http://localhost:3001/live
echo.
echo  (A pagina http://localhost:8000 e apenas telemetria crua
echo   para diagnostico, nao e o painel da treinadora.)
echo ============================================================
echo.

python server.py
pause
