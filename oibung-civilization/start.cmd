@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Install Node.js 20 or later from https://nodejs.org/ and retry. & pause & exit /b 1)
node launch.mjs
pause
