@echo off
setlocal
title Bappi Stores - Update
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if exist "%NODE_EXE%" (
  set "PATH=%~dp0bundled\nodejs;%PATH%"
  goto :run_update
)

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org or use the offline zip.
  pause
  exit /b 1
)
set "NODE_EXE=node"

:run_update
echo.
echo  ==================================================
echo   BAPPI STORES - UPDATE
echo  ==================================================
echo.
echo  Progress below. Do NOT close this window.
echo  Log saved to update-log.txt
echo.

"%NODE_EXE%" "%~dp0scripts\update.mjs"
if errorlevel 1 (
  echo.
  echo  UPDATE FAILED — see messages above and update-log.txt
  echo.
  pause
  exit /b 1
)

echo.
pause
exit /b 0
