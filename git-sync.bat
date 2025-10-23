@echo off
echo Resolviendo pull pendiente y haciendo push de cambios...

echo.
echo 1. Abortando merge actual...
git merge --abort

echo.
echo 2. Guardando cambios actuales en stash...
git stash push -m "Payment switch changes"

echo.
echo 3. Haciendo pull de Develop2...
git pull origin Develop2

echo.
echo 4. Recuperando cambios del stash...
git stash pop

echo.
echo 5. Agregando todos los archivos...
git add .

echo.
echo 6. Haciendo commit de los cambios...
git commit -m "Fix payment status switch functionality - resolve conflicts"

echo.
echo 7. Haciendo push a Develop2...
git push origin Develop2

echo.
echo ¡Proceso completado exitosamente!
pause
