@echo off
setlocal
title Bappi Stores - Fix duplicate invoices
cd /d "%~dp0"

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo.
echo  Fixes duplicate invoice numbers. Your sales are kept.
echo.
echo  BEST: Leave START.bat OPEN, then press a key here.
echo  (No need to close the shop.)
echo.
pause

"%NODE_EXE%" "%~dp0scripts\fix-invoices.mjs"
set "ERR=%ERRORLEVEL%"

echo.
if "%ERR%"=="0" (
  echo  Finished OK.
) else (
  echo  Fix failed — read the messages above.
)
echo.
pause
exit /b %ERR%
