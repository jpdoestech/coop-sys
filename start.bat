@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "NO_BROWSER=0"
if /I "%~1"=="--no-browser" set "NO_BROWSER=1"
set "APP_URL=http://127.0.0.1:5173/"

title Cooperative Records - Local System
echo.
echo ========================================
echo   Cooperative Records - Local System
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available in PATH.
  echo Run setup.bat after installing the current Node.js LTS release.
  goto :failed
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Dependencies are missing. Running setup first...
  call "%~dp0setup.bat" --no-pause
  if errorlevel 1 goto :failed
  echo.
)

powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%APP_URL%' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto :already_running

echo Starting the system at %APP_URL%
echo Keep this window open while using the application.
echo Press Ctrl+C to stop the local server.
echo.

if "%NO_BROWSER%"=="0" (
  start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%APP_URL%'"
)

call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
if errorlevel 1 goto :failed
exit /b 0

:already_running
echo The local system is already running at %APP_URL%
if "%NO_BROWSER%"=="0" start "" "%APP_URL%"
exit /b 0

:failed
echo.
echo The local system could not be started. Review the error above.
echo.
if "%NO_BROWSER%"=="0" pause
exit /b 1
