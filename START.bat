@echo off
setlocal
title Bappi Stores
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if exist "%NODE_EXE%" (
  set "PATH=%~dp0bundled\nodejs;%PATH%"
  goto :run_start
)

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org or use the offline zip, then run SETUP.bat first.
  pause
  exit /b 1
)
set "NODE_EXE=node"

:run_start
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
echo  Browser: http://127.0.0.1:5001
echo           (or http://bappistores:5001 after hostname setup)
echo  Login: admin@bappi.com  /  admin123
echo.
echo  Leave this window open while using the app.
echo  Press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 12 /nobreak >nul & start http://127.0.0.1:5001/"

"%NODE_EXE%" "%~dp0scripts\start-shop.mjs"
if errorlevel 1 (
  echo.
  echo  The app stopped with an error. Try running SETUP.bat or UPDATE.bat again.
  pause
  exit /b 1
)
pause
exit /b 0
