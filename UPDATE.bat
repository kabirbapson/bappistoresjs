@echo off
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
pause

node scripts/update.mjs
pause
