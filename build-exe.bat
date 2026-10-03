@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title Cooperative Records - Build Legacy Offline EXE
set "TOOLS_DIR=%CD%\tools\windows-server"
set "OUTPUT_DIR=%CD%\release\windows-lan-server"
set "ASSET_ZIP=%TOOLS_DIR%\web-assets.zip"
set "OUTPUT_EXE=%OUTPUT_DIR%\CooperativeRecordsServer.exe"

echo.
echo ========================================
echo   Cooperative Records - Legacy Offline EXE
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is required to build the web application.
  goto :failed
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is not available in PATH.
  goto :failed
)

if not exist "node_modules\.bin\vite.cmd" (
  echo [1/5] Installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
) else (
  echo [1/5] Dependencies are ready.
)

echo [2/5] Running code quality checks...
call npm run lint
if errorlevel 1 goto :failed
call npm test -- --run
if errorlevel 1 goto :failed

echo [3/5] Building the browser-local offline web bundle...
set "VITE_DATA_BACKEND=LOCAL"
set "VITE_APP_MODE=OFFLINE"
set "VITE_SUPABASE_URL=offline://disabled"
set "VITE_SUPABASE_PUBLISHABLE_KEY=offline"
set "VITE_SUPABASE_ANON_KEY=offline"
call npm run build -- --mode offline
if errorlevel 1 goto :failed

echo [4/5] Embedding the web bundle...
if exist "%ASSET_ZIP%" del /q "%ASSET_ZIP%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%CD%\dist\*' -DestinationPath '%ASSET_ZIP%' -CompressionLevel Optimal"
if errorlevel 1 goto :failed

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo ERROR: The Windows C# compiler was not found.
  echo Enable .NET Framework 4.8 in Windows Features, then run this file again.
  goto :failed
)

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
echo [5/5] Compiling the native server controller...
"%CSC%" /nologo /target:winexe /optimize+ /platform:anycpu /win32manifest:"%TOOLS_DIR%\app.manifest" /out:"%OUTPUT_EXE%" /resource:"%ASSET_ZIP%",CooperativeRecords.WebAssets.zip /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "%TOOLS_DIR%\LanServer.cs"
if errorlevel 1 goto :failed

del /q "%ASSET_ZIP%" >nul 2>&1
echo.
echo ========================================
echo   Build completed successfully.
echo ========================================
echo Output:
echo   %OUTPUT_EXE%
echo.
echo Run the EXE on the host PC, allow it through Windows Firewall for
echo Private networks if prompted, then share the displayed LAN address.
echo NOTE: Records in this legacy build are stored separately per browser.
echo Use build-database-exe.bat for the supported shared offline/LAN system.
echo.
pause
exit /b 0

:failed
if exist "%ASSET_ZIP%" del /q "%ASSET_ZIP%" >nul 2>&1
echo.
echo Build failed. Review the error above.
echo.
pause
exit /b 1
