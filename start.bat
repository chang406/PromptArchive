@echo off
setlocal

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
cd /d "%APP_DIR%"

where node >nul 2>nul
if errorlevel 1 goto nonode

set "PORT=3000"
if not exist ".env" goto checkport
for /f "usebackq tokens=1,2 delims==" %%A in (".env") do if /i "%%A"=="PORT" set "PORT=%%B"

:checkport
set "URL=http://localhost:%PORT%"

echo [1/3] Checking and cleaning port %PORT% ...
node -e "try{const p='%PORT%';require('child_process').execSync('netstat -ano').toString().split('\n').filter(l=>l.includes(':'+p)&&l.includes('LISTENING')).forEach(l=>{const id=l.trim().split(/\s+/).pop();if(id&&id!=='0')try{require('child_process').execSync('taskkill /F /PID '+id)}catch(e){}})}catch(e){}" >nul 2>nul

echo [2/3] Starting server in the background...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden"

set count=0
:waitloop
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 goto openbrowser
set /a count+=1
if %count% lss 10 goto waitloop

:openbrowser
echo [3/3] Opening browser at %URL% ...
start "" "%URL%"

goto end

:nonode
echo [ERROR] Node.js is not installed or not on PATH. Install it from https://nodejs.org
pause
exit /b 1

:end
endlocal
