@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT_DIR=%CD%"

title Cooperative Records - Build Database Server EXE
set "TOOLS_DIR=%CD%\tools\database-server"
set "OUTPUT_DIR=%CD%\release\windows-database-server"
set "ENGINE_EXE=%TOOLS_DIR%\CooperativeRecordsDatabaseEngine.exe"
set "OUTPUT_EXE=%OUTPUT_DIR%\CooperativeRecordsDatabaseServer.exe"

echo.
echo ==================================================
echo   Cooperative Records - SQLite Database Server
echo ==================================================
echo.

where node >nul 2>&1 || (echo ERROR: Node.js 24 or newer is required.& goto :failed)
where npm >nul 2>&1 || (echo ERROR: npm is required.& goto :failed)
if not exist "node_modules\.bin\vite.cmd" call npm install --no-audit --no-fund
if errorlevel 1 goto :failed

echo [1/7] Running validation...
call npm run lint
if errorlevel 1 goto :failed
call npm test -- --run
if errorlevel 1 goto :failed

echo [2/7] Building the server-connected web application...
set "VITE_DATA_BACKEND=SERVER"
set "VITE_APP_MODE=OFFLINE"
set "VITE_SUPABASE_URL=offline://disabled"
set "VITE_SUPABASE_PUBLISHABLE_KEY=offline"
set "VITE_SUPABASE_ANON_KEY=offline"
call npm run build -- --mode offline
if errorlevel 1 goto :failed

echo [3/7] Embedding the web application in the database engine...
node "%TOOLS_DIR%\generate-server-bundle.mjs"
if errorlevel 1 goto :failed

echo [4/7] Creating the Node single-executable payload...
pushd "%TOOLS_DIR%"
node --experimental-sea-config sea-config.json
if errorlevel 1 (popd & goto :failed)
for /f "usebackq delims=" %%N in (`node -p "process.execPath"`) do copy /y "%%N" "%ENGINE_EXE%" >nul
if not exist "%ENGINE_EXE%" (popd & echo ERROR: Could not locate node.exe.& goto :failed)

echo [5/7] Injecting the server payload...
call "%ROOT_DIR%\node_modules\.bin\postject.cmd" "%ENGINE_EXE%" NODE_SEA_BLOB "%TOOLS_DIR%\sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if errorlevel 1 (popd & goto :failed)
popd

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (echo ERROR: Enable .NET Framework 4.8 in Windows Features.& goto :failed)
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo [6/7] Compiling the server controller GUI...
"%CSC%" /nologo /target:winexe /optimize+ /platform:anycpu /win32manifest:"%CD%\tools\windows-server\app.manifest" /out:"%OUTPUT_EXE%" /resource:"%ENGINE_EXE%",CooperativeRecords.DatabaseEngine.exe /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll "%TOOLS_DIR%\DatabaseServerLauncher.cs"
if errorlevel 1 goto :failed

echo [7/7] Cleaning temporary build files...
del /q "%TOOLS_DIR%\generated-server.cjs" "%TOOLS_DIR%\sea-prep.blob" "%ENGINE_EXE%" >nul 2>&1

echo.
echo Build completed:
echo   %OUTPUT_EXE%
echo.
echo First run creates:
echo   data\cooperative-records.db
echo   data\cooperative-records.db-wal
echo   data\cooperative-records.db-shm
echo   data\server-config.json
echo.
echo Default sign-in: admin@example.test / ChangeMe123!
echo The application requires a password change after first sign-in.
echo.
pause
exit /b 0

:failed
echo.
echo Build failed. Review the error above.
echo.
pause
exit /b 1
