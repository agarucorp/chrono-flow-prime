@echo off
setlocal EnableDelayedExpansion

:: Script de inicio rápido para configurar MCP con Supabase (Windows)
:: Uso: scripts\mcp-quickstart.bat

echo ========================================================
echo   MCP + Supabase - Configuracion Rapida (Windows)
echo ========================================================
echo.

:: Verificar Node.js
echo [1/5] Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo [OK] Node.js !NODE_VERSION! instalado
) else (
    echo [ERROR] Node.js no esta instalado
    echo         Instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)
echo.

:: Instalar servidor MCP
echo [2/5] Deseas instalar el servidor MCP de Supabase globalmente? (S/N)
set /p INSTALL_MCP="> "

if /i "!INSTALL_MCP!"=="S" (
    echo Instalando @supabase-community/mcp-server-supabase...
    call npm install -g @supabase-community/mcp-server-supabase
    
    if !ERRORLEVEL! EQU 0 (
        echo [OK] Servidor MCP instalado correctamente
    ) else (
        echo [ERROR] Error al instalar el servidor MCP
        pause
        exit /b 1
    )
) else (
    echo [INFO] Omitiendo instalacion. Usaras npx en su lugar.
)
echo.

:: Obtener credenciales
echo [3/5] Configurando credenciales de Supabase
echo.
echo Necesitas obtener las siguientes credenciales de Supabase:
echo   1. Project URL (https://app.supabase.com ^> Settings ^> API ^> Project URL)
echo   2. Service Role Key (Settings ^> API ^> service_role key - clic en Reveal!)
echo   3. Database URL (Settings ^> Database ^> Connection string ^> URI)
echo.
echo Ya tienes estas credenciales? (S/N)
set /p HAS_CREDENTIALS="> "

if /i not "!HAS_CREDENTIALS!"=="S" (
    echo [INFO] Ve a https://app.supabase.com y obten tus credenciales
    echo        Luego ejecuta este script nuevamente
    pause
    exit /b 0
)
echo.

:: Crear configuración de ejemplo
echo [4/5] Creando archivo de configuracion...

if not exist "cursor-mcp-config.json" (
    copy cursor-mcp-config.example.json cursor-mcp-config.json >nul
    echo [OK] Archivo cursor-mcp-config.json creado
    echo [INFO] Edita cursor-mcp-config.json y agrega tus credenciales
) else (
    echo [INFO] cursor-mcp-config.json ya existe, no se sobrescribio
)
echo.

:: Instrucciones finales
echo [5/5] Proximos pasos:
echo.
echo 1. Edita el archivo: cursor-mcp-config.json
echo    Reemplaza los valores de ejemplo con tus credenciales reales
echo.
echo 2. Copia la configuracion a Cursor:
echo    Ubicacion: %%APPDATA%%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
echo.
echo 3. Reinicia Cursor
echo.
echo 4. Verifica la configuracion ejecutando:
echo    npm run verify:mcp
echo.
echo ========================================================
echo Para mas informacion, consulta:
echo   - MCP_SUPABASE_SETUP.md (guia completa)
echo   - MCP_CREDENTIALS.md (informacion sobre credenciales)
echo ========================================================
echo.

pause

