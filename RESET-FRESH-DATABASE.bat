@echo off
title Bappi Stores - Reset database (fresh start)
cd /d "%~dp0"
echo.
echo  USE ONLY IF YOU HAVE NO REAL SALES YET
echo  =====================================
echo.
echo  This moves the broken database aside and creates a new empty one.
echo  Sample products will load again on the next START.
echo.
echo  If you already recorded real sales, press Ctrl+C now and use BACKUP.bat instead.
echo.
pause

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

"%NODE_EXE%" "%~dp0scripts\repair-database.mjs" --reset-fresh
if errorlevel 1 (
  echo.
  echo  RESET FAILED — see repair-log.txt
  pause
  exit /b 1
)

echo.
echo  Now run START.bat
echo.
pause
exit /b 0
