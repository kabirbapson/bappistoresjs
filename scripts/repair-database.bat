@echo off
title Bappi Stores - Repair database engine
cd /d "%~dp0"
echo.
echo  This clears the downloaded MongoDB engine cache only.
echo  Your sales in data\mongodb are NOT deleted.
echo.
pause
if exist "data\mongodb-bin" rmdir /s /q "data\mongodb-bin"
echo.
echo  Cache cleared. Run SETUP.bat again with internet connected.
echo.
pause
