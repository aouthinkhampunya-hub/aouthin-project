@echo off
title Restarting Aouthin Docker Containers...
cd /d "%~dp0"
echo ===================================================
echo   Rebuilding and Restarting Aouthin Containers
echo ===================================================
docker compose down
docker compose up -d --build
echo.
echo Containers rebuilt and started!
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:3000
echo ===================================================
pause
