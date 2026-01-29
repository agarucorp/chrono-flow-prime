@echo off
REM Merge Develop2 into main
cd /d "%~dp0.."

echo === Branches actuales ===
git branch -a

echo.
echo === Checkout main ===
git checkout main

echo.
echo === Merge Develop2 en main ===
git merge Develop2 -m "Merge branch 'Develop2' into main"

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Hubo conflictos. Resolvelos y luego: git add . ^&^& git commit -m "Resolve merge Develop2 into main"
  exit /b 1
)

echo.
echo === Estado final ===
git status
git log -1 --oneline

echo.
echo === Push a origin (opcional) ===
echo Si queres subir los cambios: git push origin main
pause
