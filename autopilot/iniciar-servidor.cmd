@echo off
title Aithera Autopilot - servidor
cd /d "%~dp0"
where node >nul 2>nul || (
  echo.
  echo   No se ha encontrado Node.js.
  echo   Instalalo desde https://nodejs.org  ^(version LTS^)
  echo   o abre index.html con doble clic para ver la web sin backend.
  echo.
  pause
  exit /b
)
start "" http://localhost:3000
node server\server.js
pause
