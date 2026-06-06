@echo off
title Bappi Stores - Repair database engine
cd /d "%~dp0"
echo.
echo  This repairs the built-in database on this PC.
echo  Your sales in data\mongodb are kept (repair runs on that folder).
echo.
echo  Steps:
echo    1) Stop the app
echo    2) Clear engine cache + lock files
echo    3) Run mongod --repair if needed
echo.
pause

set "NODE_EXE=%~dp0bundled\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

"%NODE_EXE%" "%~dp0scripts\repair-database.mjs"
if errorlevel 1 (
  echo.
  echo  REPAIR FAILED — see repair-log.txt
  pause
  exit /b 1
)
echo.
pause
exit /b 0
