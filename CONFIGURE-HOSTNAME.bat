@echo off
title Bappi Stores - Hostname setup
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo  This step needs Administrator rights.
  echo  Right-click CONFIGURE-HOSTNAME.bat and choose "Run as administrator"
  echo.
  pause
  exit /b 1
)

node scripts/configure-hostname.mjs --write
echo.
pause
