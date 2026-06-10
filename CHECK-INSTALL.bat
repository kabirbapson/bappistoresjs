@echo off
setlocal
title Bappi Stores - Pre-install check
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo.
echo  Checks folder location and database engine BEFORE setup.
echo.

"%NODE_EXE%" "%~dp0scripts\check-install.mjs"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
echo.
pause
exit /b 0
