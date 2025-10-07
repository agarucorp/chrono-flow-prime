#!/bin/bash

# Script de inicio rápido para configurar MCP con Supabase
# Uso: bash scripts/mcp-quickstart.sh

echo "╔════════════════════════════════════════════════════════╗"
echo "║  MCP + Supabase - Configuración Rápida               ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Paso 1: Verificar Node.js
echo -e "${CYAN}[1/5]${NC} Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION instalado"
else
    echo -e "${RED}✗${NC} Node.js no está instalado"
    echo -e "${YELLOW}⚠${NC}  Instala Node.js desde https://nodejs.org"
    exit 1
fi
echo ""

# Paso 2: Instalar servidor MCP de Supabase
echo -e "${CYAN}[2/5]${NC} ¿Deseas instalar el servidor MCP de Supabase globalmente? (s/n)"
read -r INSTALL_MCP

if [ "$INSTALL_MCP" = "s" ] || [ "$INSTALL_MCP" = "S" ]; then
    echo "Instalando @supabase-community/mcp-server-supabase..."
    npm install -g @supabase-community/mcp-server-supabase
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Servidor MCP instalado correctamente"
    else
        echo -e "${RED}✗${NC} Error al instalar el servidor MCP"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC}  Omitiendo instalación. Usarás npx en su lugar."
fi
echo ""

# Paso 3: Obtener credenciales
echo -e "${CYAN}[3/5]${NC} Configurando credenciales de Supabase"
echo ""
echo -e "${YELLOW}Necesitas obtener las siguientes credenciales de Supabase:${NC}"
echo "  1. Project URL (https://app.supabase.com > Settings > API > Project URL)"
echo "  2. Service Role Key (Settings > API > service_role key - ¡clic en Reveal!)"
echo "  3. Database URL (Settings > Database > Connection string > URI)"
echo ""
echo "¿Ya tienes estas credenciales? (s/n)"
read -r HAS_CREDENTIALS

if [ "$HAS_CREDENTIALS" != "s" ] && [ "$HAS_CREDENTIALS" != "S" ]; then
    echo -e "${YELLOW}⚠${NC}  Ve a https://app.supabase.com y obtén tus credenciales"
    echo "    Luego ejecuta este script nuevamente"
    exit 0
fi
echo ""

# Paso 4: Crear configuración de ejemplo
echo -e "${CYAN}[4/5]${NC} Creando archivo de configuración..."

if [ ! -f "cursor-mcp-config.json" ]; then
    cp cursor-mcp-config.example.json cursor-mcp-config.json
    echo -e "${GREEN}✓${NC} Archivo cursor-mcp-config.json creado"
    echo -e "${YELLOW}⚠${NC}  Edita cursor-mcp-config.json y agrega tus credenciales"
else
    echo -e "${YELLOW}⚠${NC}  cursor-mcp-config.json ya existe, no se sobrescribió"
fi
echo ""

# Paso 5: Instrucciones finales
echo -e "${CYAN}[5/5]${NC} Próximos pasos:"
echo ""
echo "1. Edita el archivo: cursor-mcp-config.json"
echo "   Reemplaza los valores de ejemplo con tus credenciales reales"
echo ""
echo "2. Copia la configuración a Cursor:"
echo "   - Windows: %APPDATA%\\Cursor\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json"
echo "   - Mac: ~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
echo "   - Linux: ~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
echo ""
echo "3. Reinicia Cursor"
echo ""
echo "4. Verifica la configuración ejecutando:"
echo "   npm run verify:mcp"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Para más información, consulta:${NC}"
echo "  • MCP_SUPABASE_SETUP.md (guía completa)"
echo "  • MCP_CREDENTIALS.md (información sobre credenciales)"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"

