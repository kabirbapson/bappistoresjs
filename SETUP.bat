@echo off
setlocal
title Bappi Stores - Setup
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if exist "%NODE_EXE%" (
  set "PATH=%~dp0bundled\nodejs;%PATH%"
  goto :run_setup
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Use the full offline zip from IT ^(includes bundled\nodejs^),
  echo  or install LTS from https://nodejs.org
  echo.
  pause
  exit /b 1
)
set "NODE_EXE=node"

:run_setup
echo.
echo  ==================================================
echo   BAPPI STORES - SETUP
echo  ==================================================
echo.
if exist "%~dp0bundled\OFFLINE.txt" (
  echo  Offline package - no internet required.
) else (
  echo  Internet needed once for packages and database download.
)
echo.
echo  Progress will show below in real time.
echo  This can take 5-15 minutes. Do NOT close this window.
echo  A copy is also saved to setup-log.txt
echo.

"%NODE_EXE%" "%~dp0scripts\install.mjs"
if errorlevel 1 (
  echo.
  echo  ==================================================
  echo   SETUP FAILED
  echo  ==================================================
  echo  See messages above and setup-log.txt
  echo.
  pause
  exit /b 1
)

echo.
pause
exit /b 0
