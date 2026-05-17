@echo off
setlocal
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

echo.
echo  Bappi Stores setup running...
echo  A log file will be saved if anything fails: setup-log.txt
echo.

node "%~dp0scripts\install.mjs" > "%~dp0setup-log.txt" 2>&1
if errorlevel 1 (
  echo.
  echo  ========================================
  echo   SETUP FAILED
  echo  ========================================
  echo.
  type "%~dp0setup-log.txt"
  echo.
  echo  Full log saved in: setup-log.txt
  echo  Send this file to your IT contact if you need help.
  echo.
  pause
  exit /b 1
)

type "%~dp0setup-log.txt"
echo.
echo  Next: double-click START.bat to run the shop app.
echo.
pause
exit /b 0
