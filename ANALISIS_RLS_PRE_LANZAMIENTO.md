# Análisis de Políticas RLS - Pre Lanzamiento

## 🔴 PROBLEMAS CRÍTICOS DETECTADOS

### Tablas SIN RLS Habilitado (Crítico para Seguridad)

#### 1. **cuotas_mensuales** - SIN RLS
**Estado**: ❌ RLS Deshabilitado
**Riesgo**: CRÍTICO - Cualquier usuario autenticado puede ver TODAS las cuotas de TODOS los usuarios

**Acción Requerida**: HABILITAR RLS y crear políticas

#### 2. **profiles** - SIN RLS  
**Estado**: ❌ RLS Deshabilitado
**Riesgo**: MEDIO - Contiene información sensible de usuarios

**Acción Requerida**: Las políticas existen pero RLS está deshabilitado

#### 3. **turnos_variables** - SIN RLS
**Estado**: ❌ RLS Deshabilitado  
**Riesgo**: CRÍTICO - Cualquier usuario puede insertar/eliminar turnos de cualquier otro usuario

**Acción Requerida**: HABILITAR RLS

## ✅ TABLAS CON RLS CORRECTO

### Horarios y Clases
- `horarios_recurrentes_usuario` ✅
- `horarios_semanales` ✅
- `horarios_bloqueados` ✅

### Ausencias y Configuración
- `ausencias_admin` ✅
- `configuracion_admin` ✅
- `capacidad_especial_dias` ✅

### Turnos
- `turnos` ✅
- `turnos_cancelados` ✅
- `turnos_disponibles` ✅

### Historial
- `historial_tarifas` ✅

## 📋 ACCIONES REQUERIDAS ANTES DE LANZAMIENTO

### Prioridad CRÍTICA

1. **Habilitar RLS en `cuotas_mensuales`**
2. **Habilitar RLS en `turnos_variables`**
3. **Habilitar RLS en `profiles`** (o verificar por qué está deshabilitado)

### Políticas Requeridas

#### Para `cuotas_mensuales`:
- SELECT: Usuarios ven solo sus propias cuotas, admins ven todas
- INSERT/DELETE/UPDATE: Solo admins

#### Para `turnos_variables`:
- SELECT: Usuarios ven solo sus turnos, admins ven todos
- INSERT: Usuarios pueden insertar para sí mismos, admins para cualquiera
- UPDATE/DELETE: Solo admins

#### Para `profiles`:
- Ya tiene políticas definidas, solo falta habilitar RLS

## 🔍 REVISIÓN DE POLÍTICAS EXISTENTES

### Verificaciones Necesarias

1. **Funciones con SECURITY DEFINER**
   - Verificar que todas las funciones que modifican datos usan `SECURITY DEFINER`
   - Esto es crucial para que los triggers funcionen correctamente

2. **Recursión en políticas**
   - `turnos_cancelados` tiene políticas que consultan `profiles`
   - `profiles` está deshabilitado RLS, esto puede causar problemas

3. **Verificación de admin**
   - Todas las políticas que verifican si es admin usan: `EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')`
   - Esto puede fallar si `profiles` no tiene RLS

## ⚠️ RIESGOS IDENTIFICADOS

### Riesgo ALTO
- **Sin RLS en cuotas_mensuales**: Cualquier usuario puede ver ingresos de otros usuarios
- **Sin RLS en turnos_variables**: Cualquier usuario puede manipular turnos de otros

### Riesgo MEDIO
- **Sin RLS en profiles**: Políticas pueden no funcionar correctamente
- **Dependencia recursiva**: Políticas que verifican admin pueden fallar

## 🎯 PRÓXIMOS PASOS

1. Crear script para habilitar RLS en las 3 tablas críticas
2. Crear/verificar políticas para cada tabla
3. Probar que los triggers siguen funcionando con RLS habilitado
4. Documentar todas las políticas implementadas

