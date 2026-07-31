@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

set "PORT=3000"
if not exist ".env" goto checkport
for /f "usebackq tokens=1,2 delims==" %%A in (".env") do if /i "%%A"=="PORT" set "PORT=%%B"

:checkport
set "URL=http://localhost:%PORT%"

echo Checking port %PORT% ...
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 goto alreadyrunning

echo Starting server in the background...
powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

set count=0
:waitloop
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if %errorlevel%==0 goto openbrowser
set /a count+=1
if %count% lss 15 goto waitloop
echo [WARN] Could not confirm the server is up yet. Opening the browser anyway.
goto openbrowser

:alreadyrunning
echo Server is already running. Opening the browser only.
goto openbrowser

:openbrowser
start "" "%URL%"
goto end

:nonode
echo [ERROR] Node.js is not installed or not on PATH. Install it from https://nodejs.org
pause
exit /b 1

:end
endlocal
