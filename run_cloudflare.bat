@echo off
title Aouthin - Cloudflare Tunnel Online Helper
color 0B

cd /d "%~dp0"

:menu
cls
echo ================================================================
echo           AOUTHIN - CLOUDFLARE TUNNEL ONLINE HELPER
echo ================================================================
echo.
echo  [1] Connect Full System Online (Port 5173: Frontend + API + Media)
echo      * Recommended: Allows mobile customers to open Menu, Admin ^& Kitchen
echo.
echo  [2] Connect Backend API Only (Port 3000)
echo.
echo  [3] Connect Custom Port (Specify any port)
echo.
echo  [4] Check / Start Docker Containers
echo.
echo  [5] Exit
echo.
echo ================================================================
set "choice=1"
set /p choice="Please select an option (1-5) [Default: 1]: "

if "%choice%"=="1" goto tunnel_5173
if "%choice%"=="2" goto tunnel_3000
if "%choice%"=="3" goto tunnel_custom
if "%choice%"=="4" goto start_docker
if "%choice%"=="5" goto exit_script

echo Invalid choice.
ping 127.0.0.1 -n 2 >nul
goto menu

:tunnel_5173
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1" -Port 5173
echo.
echo Tunnel closed.
pause
goto menu

:tunnel_3000
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1" -Port 3000
echo.
echo Tunnel closed.
pause
goto menu

:tunnel_custom
cls
set "TARGET_PORT="
set /p TARGET_PORT="Enter local port to connect online (e.g. 5173, 3000, 80): "
if "%TARGET_PORT%"=="" goto menu
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel.ps1" -Port %TARGET_PORT%
echo.
echo Tunnel closed.
pause
goto menu

:start_docker
cls
echo ================================================================
echo    Starting Docker Containers
echo ================================================================
echo.
docker compose up -d
echo.
docker compose ps
echo.
pause
goto menu

:exit_script
exit /b 0
