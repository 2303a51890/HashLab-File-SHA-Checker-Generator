@echo off
setlocal
title HashLab
cd /d "%~dp0"

set "PORT=8000"
set "PY="

where py >nul 2>&1 && set "PY=py"
if not defined PY where python >nul 2>&1 && set "PY=python"

if not defined PY (
    echo Python 3 was not found.
    echo Install it from https://www.python.org/downloads/ or serve this folder with any static web server.
    pause
    exit /b 1
)

echo HashLab is running at http://localhost:%PORT%
echo Press Ctrl+C to stop the server.

start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"
%PY% -m http.server %PORT% --bind 127.0.0.1
