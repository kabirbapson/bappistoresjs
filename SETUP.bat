@echo off
setlocal
title Ashuk & Ashman Beverages - Setup
cd /d "%~dp0"

if exist "%~dp0bundled\vc_redist.x64.exe" (
  echo  Checking Microsoft Visual C++ runtime...
  start /wait "" "%~dp0bundled\vc_redist.x64.exe" /install /quiet /norestart
)

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
echo   ASHUK & ASHMAN BEVERAGES - SETUP
echo  ==================================================
echo.
echo  IMPORTANT - WHERE TO INSTALL:
echo    Use  C:\BappiStores
echo    NOT Documents, Desktop, or OneDrive ^(database will break^).
echo.
if exist "%~dp0bundled\OFFLINE.txt" (
  echo  Offline package - no internet required.
  echo  Run CHECK-INSTALL.bat first if setup failed before.
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
