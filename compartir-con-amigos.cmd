@echo off
REM ---------------------------------------------------------------
REM  Aithera Autopilot - compartir la web con un enlace publico
REM  Arranca el servidor local Y un tunel de Cloudflare que le da
REM  una URL publica temporal (https://....trycloudflare.com).
REM  Cualquiera con ese enlace vera tu web, sin que abras puertos
REM  en tu router. El enlace deja de funcionar en cuanto cierres
REM  la ventana del tunel (o esta ventana).
REM
REM  Necesita cloudflared. Si no lo tienes, este script te dice
REM  como instalarlo la primera vez.
REM ---------------------------------------------------------------
title Aithera Autopilot - enlace publico
cd /d "%~dp0"

where node >nul 2>nul || (
  echo.
  echo   No se ha encontrado Node.js.
  echo   Instalalo desde https://nodejs.org  ^(version LTS^) y vuelve a intentarlo.
  echo.
  pause
  exit /b
)

set CF=cloudflared
if exist "cloudflared.exe" set CF=cloudflared.exe

"%CF%" --version >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se ha encontrado cloudflared. Instalalo con una de estas dos opciones
  echo   y vuelve a ejecutar este archivo:
  echo.
  echo     1^) Con winget ^(mas facil^): abre PowerShell y ejecuta
  echo           winget install --id Cloudflare.cloudflared -e
  echo.
  echo     2^) Manual: descarga cloudflared-windows-amd64.exe desde
  echo           https://github.com/cloudflare/cloudflared/releases/latest
  echo        renombralo a "cloudflared.exe" y ponlo en esta misma carpeta
  echo        ^(junto a este archivo .cmd^).
  echo.
  pause
  exit /b
)

echo Arrancando el servidor local...
start "Aithera - servidor" cmd /k "node server\server.js"

timeout /t 2 /nobreak >nul

echo.
echo Abriendo el enlace publico con Cloudflare Tunnel...
echo   -^> La URL https://....trycloudflare.com aparecera en la ventana
echo      "Aithera - enlace publico" que se va a abrir. Copiala de ahi
echo      y comparte esa con quien quieras que vea la web.
echo   -^> El enlace cambia cada vez que arrancas este script y deja de
echo      funcionar en cuanto cierres esa ventana.
echo.
start "Aithera - enlace publico" cmd /k ""%CF%" tunnel --url http://localhost:3000"

echo Listo. Mira la ventana "Aithera - enlace publico" para copiar el enlace.
pause
