@echo off
setlocal
title Bappi Stores - Fix duplicate invoices
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo.
echo  Fixes duplicate invoice numbers in the database.
echo  Your sales data is kept — only invoice IDs may change.
echo.
pause

"%NODE_EXE%" "%~dp0server\src\fix-duplicate-invoices.js"
if errorlevel 1 (
  echo.
  echo  Fix failed. Is the app closed? Try again after closing START.bat.
  pause
  exit /b 1
)

echo.
echo  Done. You can run START.bat now.
echo.
pause
exit /b 0
