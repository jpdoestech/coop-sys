@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "NO_PAUSE=0"
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"

title Cooperative Records - Setup
echo.
echo ========================================
echo   Cooperative Records - Setup
echo ========================================
echo.

if not exist "package.json" (
  echo ERROR: package.json was not found in %CD%.
  goto :failed
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available in PATH.
  echo Install the current Node.js LTS release, then run this file again.
  goto :failed
)

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is not installed or is not available in PATH.
  goto :failed
)

for /f "delims=" %%V in ('node --version') do set "NODE_VERSION=%%V"
for /f "delims=" %%V in ('npm --version') do set "NPM_VERSION=%%V"
echo Node.js: %NODE_VERSION%
echo npm:     %NPM_VERSION%
echo.

if not exist ".env.local" if exist ".env.example" (
  copy /Y ".env.example" ".env.local" >nul
  echo Created .env.local from .env.example.
  echo The default AUTO mode runs locally when Supabase credentials are blank.
  echo.
)

echo [1/4] Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :failed

echo.
echo [2/4] Checking code quality...
call npm run lint
if errorlevel 1 goto :failed

echo.
echo [3/4] Running automated tests...
call npm test
if errorlevel 1 goto :failed

echo.
echo [4/4] Building the production bundle...
call npm run build
if errorlevel 1 goto :failed

echo.
echo ========================================
echo   Setup completed successfully.
echo ========================================
echo Run start.bat to open the local system.
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 0

:failed
echo.
echo Setup did not complete. Review the error above and try again.
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 1
