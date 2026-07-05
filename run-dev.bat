@echo off
setlocal

set "REPO_DIR=%~dp0"
set "BACKEND_DIR=%REPO_DIR%backend\poker_project"
set "BACKEND_PYTHON=%REPO_DIR%backend\.venv\Scripts\python.exe"
set "FRONTEND_DIR=%REPO_DIR%frontend"

if not exist "%BACKEND_PYTHON%" (
    echo ERROR: Backend virtual environment not found.
    echo Create it with: python -m venv backend\.venv
    echo Then install: backend\.venv\Scripts\python.exe -m pip install -r backend\poker_project\requirements.txt
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo ERROR: Frontend dependencies not installed.
    echo Run: cd frontend ^&^& npm ci
    pause
    exit /b 1
)

set "DJANGO_DEBUG=true"
set "DJANGO_SECRET_KEY=local-only-development-key-never-use-in-production-123456789"
set "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1"

start "Planning Poker API" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%BACKEND_PYTHON%"" manage.py migrate && ""%BACKEND_PYTHON%"" manage.py runserver 127.0.0.1:8000"
start "Planning Poker UI" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo Backend: http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
echo Development servers are opening in separate windows.
pause
