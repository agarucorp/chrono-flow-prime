# Verificación del Sistema de Ausencias del Admin

## Flujo Esperado

### 1. Creación de Ausencia por el Admin ✅
- **Ubicación**: Panel Admin > Configuración > Editar Ausencias
- **Componente**: `TurnoManagement.tsx`
- **Función**: `handleAgregarAusenciaUnica()` o `handleAgregarAusenciaPeriodo()`
- **Base de datos**: Tabla `ausencias_admin`
- **Evento**: Dispara `window.dispatchEvent(new Event('ausenciasAdmin:updated'))`

**Verificación**:
```sql
-- Ver ausencias activas
SELECT * FROM ausencias_admin WHERE activo = true ORDER BY fecha_inicio DESC;
```

### 2. Bloqueo Visual en Panel de Usuarios ✅
- **Ubicación**: Panel Usuario > Mis Clases
- **Componente**: `RecurringScheduleView.tsx`
- **Función**: `estaClaseBloqueada()` - línea 158
- **Visual**: Fondo amarillo + texto "CLASE BLOQUEADA"

**Verificación**:
- Ausencia única: Verifica `fecha_inicio` y `clases_canceladas[]`
- Ausencia por período: Verifica que la fecha esté entre `fecha_inicio` y `fecha_fin`

### 3. Exclusión de Balance Mensual ⚠️ PARCIAL
- **Ubicación**: Panel Admin > Historial de Balance
- **Componente**: `HistorialBalance.tsx` (ORIGINAL - NO ACTUALIZADO)
- **Componente Corregido**: `HistorialBalanceCorregido.tsx` (NUEVO)
- **Función**: `estaClaseBloqueada()` + filtrado de turnos válidos

**PROBLEMA DETECTADO**: El componente `HistorialBalance.tsx` original **NO** está filtrando las clases bloqueadas.

**Solución**: El archivo `HistorialBalanceCorregido.tsx` tiene la lógica correcta pero no se está usando.

### 4. Visualización en Agenda del Admin ❌ NO VERIFICADO
- **Ubicación**: Panel Admin > Agenda
- **Componente**: `CalendarView.tsx`
- **Estado Esperado**: Los usuarios deben aparecer pero sin poder seleccionarlos

**PROBLEMA**: No se encontró código que verifique ausencias del admin en `CalendarView.tsx`.

### 5. Impacto en Balance Total ⚠️ PARCIAL
- **Depende de**: Punto 3 (Exclusión de Balance Mensual)
- **Estado**: Solo funcionará si se usa `HistorialBalanceCorregido.tsx`

### 6. Bloqueo en Vacantes ❌ NO VERIFICADO
- **Ubicación**: Panel Usuario > Vacantes
- **Componente**: `RecurringScheduleView.tsx` (vista de turnos disponibles)
- **Estado Esperado**: Clases bloqueadas deben aparecer como "No disponibles"

**PROBLEMA**: No se encontró código que bloquee turnos en la vista de "Vacantes".

---

## Plan de Corrección

### 1. Reemplazar `HistorialBalance.tsx` con la versión corregida
```bash
# Hacer backup del original
mv src/components/HistorialBalance.tsx src/components/HistorialBalance.BACKUP.tsx

# Usar la versión corregida (necesita completarse)
# El archivo HistorialBalanceCorregido.tsx está incompleto
```

### 2. Agregar verificación de ausencias en `CalendarView.tsx`
- Cargar ausencias del admin
- Aplicar estilos visuales a las clases bloqueadas
- Deshabilitar selección de clases bloqueadas

### 3. Agregar verificación de ausencias en la vista "Vacantes"
- Filtrar turnos bloqueados por ausencias del admin
- Mostrar como "No disponible"

### 4. Crear datos de prueba
```sql
-- Insertar ausencia de prueba (única)
INSERT INTO ausencias_admin (tipo_ausencia, fecha_inicio, fecha_fin, clases_canceladas, motivo, activo)
VALUES ('unica', '2025-01-25T12:00:00', NULL, ARRAY[1, 2, 3], 'Prueba de sistema', true);

-- Insertar ausencia de prueba (período)
INSERT INTO ausencias_admin (tipo_ausencia, fecha_inicio, fecha_fin, clases_canceladas, motivo, activo)
VALUES ('periodo', '2025-01-27T00:00:00', '2025-01-29T23:59:59', NULL, 'Prueba de período', true);
```

---

## Estado Actual del Sistema

| Funcionalidad | Estado | Componente | Prioridad |
|--------------|--------|------------|-----------|
| 1. Creación de ausencia | ✅ Funciona | TurnoManagement.tsx | - |
| 2. Bloqueo visual en usuario | ✅ Funciona | RecurringScheduleView.tsx | - |
| 3. Exclusión de balance | ⚠️ Parcial | HistorialBalance.tsx | 🔴 ALTA |
| 4. Visual en agenda admin | ❌ No implementado | CalendarView.tsx | 🟡 MEDIA |
| 5. Impacto en balance total | ⚠️ Parcial | Depende de #3 | 🔴 ALTA |
| 6. Bloqueo en vacantes | ❌ No implementado | RecurringScheduleView.tsx | 🟡 MEDIA |

---

## Próximos Pasos

1. **URGENTE**: Completar y activar `HistorialBalanceCorregido.tsx`
2. **IMPORTANTE**: Implementar bloqueo visual en `CalendarView.tsx`
3. **IMPORTANTE**: Implementar bloqueo en vista "Vacantes"
4. **TESTING**: Crear datos de prueba y verificar cada punto del flujo
5. **LIMPIEZA**: Eliminar datos de prueba después de verificación

