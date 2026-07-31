@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
if errorlevel 1 (
  echo.
  echo No fue posible iniciar Gastro Suite. Revisa el mensaje anterior.
  pause
  exit /b 1
)
echo.
echo Puedes cerrar esta ventana. Los servicios quedaron ejecutandose en segundo plano.
pause
