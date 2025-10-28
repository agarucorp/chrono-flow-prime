#!/bin/bash

# Script de prueba para la Edge Function enviar-cobros-mensuales
# Ejecutar: bash scripts/test-enviar-cobros.sh

export SUPABASE_ANON_KEY="tu_supabase_anon_key_aqui"

echo "🚀 Probando función enviar-cobros-mensuales..."
echo ""

curl -X POST "https://bihqdptdkgdfztufrmlm.supabase.co/functions/v1/enviar-cobros-mensuales" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"anio": 2025, "mes": 11}'

echo ""
echo ""
echo "✅ Completado. Revisa los logs en Supabase Dashboard → Functions → Logs"

