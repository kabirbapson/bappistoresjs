@echo off
setlocal
title Bappi Stores - Test database
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo.
echo  Testing bundled MongoDB on this PC...
echo.

"%NODE_EXE%" "%~dp0scripts\test-database.mjs"
echo.
pause
exit /b %ERRORLEVEL%
