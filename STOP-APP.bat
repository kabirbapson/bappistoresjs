@echo off
setlocal
title Bappi Stores - Stop app
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo.
echo  Stopping Bappi Stores (close database for FIX-INVOICES / repair).
echo.

"%NODE_EXE%" "%~dp0scripts\stop-app.mjs"
echo.
pause
exit /b 0
