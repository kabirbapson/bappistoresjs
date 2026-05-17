@echo off
title Bappi Stores - Setup
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Download LTS from https://nodejs.org
  echo  Install it, restart this PC, then run SETUP.bat again.
  echo.
  pause
  exit /b 1
)

node scripts/install.mjs
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

echo.
echo  Next: double-click START.bat to run the shop app.
echo.
pause
