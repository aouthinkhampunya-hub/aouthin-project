@echo off
title Starting Aouthin on Docker...
cd /d "%~dp0"
echo ===================================================
echo   Starting Aouthin (Frontend + Backend) in Docker
echo ===================================================
docker compose up -d
echo.
echo Application started!
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:3000
echo ===================================================
pause
