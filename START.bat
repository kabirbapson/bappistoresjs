@echo off
title Bappi Stores
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org then run SETUP.bat first.
  pause
  exit /b 1
)

if not exist ".setup-complete" (
  echo.
  echo  Setup has not been run yet.
  echo  Double-click SETUP.bat first ^(one time only^).
  echo.
  pause
  exit /b 1
)

echo.
echo  Bappi Stores is starting...
echo  Browser: http://bappistores:5001
echo  Login: admin@bappi.com  /  admin123
echo.
echo  Leave this window open while using the app.
echo  Press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 12 /nobreak >nul & start http://bappistores:5001/"

npm run start
pause
