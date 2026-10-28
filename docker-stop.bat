@echo off
title Stopping Aouthin Docker Containers...
cd /d "%~dp0"
echo ===================================================
echo   Stopping Aouthin Docker Containers
echo ===================================================
docker compose down
echo.
echo All containers stopped!
echo ===================================================
pause
