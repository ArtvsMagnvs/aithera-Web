@echo off
REM ---------------------------------------------------------------
REM  Aithera Autopilot - solo la web, SIN backend
REM  Util si no tienes Node.js instalado. El formulario funcionara
REM  en modo demostracion (valida y confirma, pero no guarda nada).
REM  Para el formulario real usa iniciar-servidor.cmd
REM ---------------------------------------------------------------
title Aithera Autopilot - web sin backend
cd /d "%~dp0"
where python >nul 2>nul && (
  start "" http://localhost:8080
  echo Web en http://localhost:8080   ^(Ctrl+C para parar^)
  python -m http.server 8080
  exit /b
)
echo No se ha encontrado Python. Abre index.html con doble clic.
pause
