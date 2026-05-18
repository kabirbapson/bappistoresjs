@echo off
setlocal
title Bappi Stores - Restore backup
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo.
echo  RESTORE from Backups folder
echo  Close START.bat first.
echo.

"%NODE_EXE%" "%~dp0scripts\restore-backup.mjs"
pause
exit /b %ERRORLEVEL%
