@echo off
setlocal
title Bappi Stores - Update
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  This updates the app and keeps your sales records.
echo  It does NOT delete data\mongodb or server\uploads .
echo.

node "%~dp0scripts\update.mjs" > "%~dp0update-log.txt" 2>&1
if errorlevel 1 (
  echo.
  echo  UPDATE FAILED — see update-log.txt
  echo.
  type "%~dp0update-log.txt"
  pause
  exit /b 1
)

type "%~dp0update-log.txt"
echo.
pause
exit /b 0
