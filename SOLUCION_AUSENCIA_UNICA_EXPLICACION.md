# 🔧 SOLUCIÓN: Ausencia Única No Bloquea Clases

## 📋 Problema Reportado

**Síntoma:** El admin cancela la clase de 7 a 8am el día 21/10/25:
- ✅ Se guarda correctamente en la tabla `ausencias_admin`
- ❌ NO se bloquea para el usuario en su vista "Mis Clases"

**Pero:** El flujo de `ausencia_periodo` funciona correctamente

---

## 🔍 Diagnóstico

He realizado un análisis exhaustivo del código y encontré **DOS problemas principales**:

### ❌ Problema 1: Vista `vista_horarios_usuarios` No Existe

La aplicación intenta usar la vista `vista_horarios_usuarios` pero esta **NO existe en la base de datos**.

**Código en `RecurringScheduleView.tsx` (línea 215-220):**
```typescript
const { data, error } = await supabase
  .from('vista_horarios_usuarios')  // ← Esta vista NO existe
  .select('id, dia_semana, clase_numero, hora_inicio, hora_fin, activo, usuario_id')
  .eq('usuario_id', user.id)
```

**Impacto:** Sin esta vista, los horarios no cargan correctamente con `clase_numero`, que es ESENCIAL para el bloqueo de ausencias únicas.

### ❌ Problema 2: Posible Falta de `clase_numero` en Horarios de Usuario

Los usuarios pueden tener horarios en `horarios_recurrentes_usuario` **SIN** el campo `clase_numero` asignado.

**Por qué es crítico:**
- Las ausencias únicas bloquean clases **por número** (Clase 1, Clase 2, etc.)
- Si el horario del usuario no tiene `clase_numero`, no puede compararse con `clases_canceladas`

---

## ✅ Solución Implementada

He creado **3 scripts SQL** para solucionar todo:

### 1️⃣ `DIAGNOSTICO_AUSENCIA_UNICA.sql`

**Propósito:** Diagnosticar el estado actual del sistema

**Qué verifica:**
- ✅ Si la tabla `ausencias_admin` existe y tiene datos
- ✅ Si `horarios_semanales` tiene `clase_numero`
- ✅ Si `horarios_recurrentes_usuario` tiene `clase_numero`
- ✅ Si la vista `vista_horarios_usuarios` existe
- ✅ Qué clases deberían estar bloqueadas
- ✅ Qué usuarios tienen clases ese día

**Cómo usarlo:**
```sql
-- Ejecutar en Supabase SQL Editor
-- Copiar y pegar el contenido completo
-- Revisar los resultados paso a paso
```

### 2️⃣ `CREAR_VISTA_HORARIOS_USUARIOS.sql`

**Propósito:** Crear la vista faltante

**Qué hace:**
```sql
CREATE OR REPLACE VIEW vista_horarios_usuarios AS
SELECT 
  hru.id,
  hru.usuario_id,
  hru.dia_semana,
  hru.clase_numero,
  COALESCE(hs.hora_inicio, hru.hora_inicio) as hora_inicio,
  COALESCE(hs.hora_fin, hru.hora_fin) as hora_fin,
  hru.activo,
  CONCAT('Clase ', hru.clase_numero) as nombre_clase
FROM horarios_recurrentes_usuario hru
LEFT JOIN horarios_semanales hs 
  ON hs.dia_semana = hru.dia_semana 
  AND hs.clase_numero = hru.clase_numero
WHERE hru.activo = true;
```

**Beneficio:** Combina datos de usuario con horas actualizadas del admin

### 3️⃣ `SOLUCION_AUSENCIA_UNICA_COMPLETA.sql` ⭐ **SCRIPT PRINCIPAL**

**Propósito:** Solución completa automatizada

**Qué hace paso a paso:**

1. **Verifica columna `clase_numero`**
   - Si no existe → la crea
   - Si existe → continúa

2. **Migra datos existentes**
   - Asigna `clase_numero` a horarios que no lo tienen
   - Hace match por `dia_semana` + `hora_inicio`

3. **Crea la vista**
   - Elimina vista anterior si existe
   - Crea `vista_horarios_usuarios`
   - Configura permisos

4. **Crea índices**
   - Para mejorar performance
   - Búsquedas por `clase_numero`

5. **Verifica todo**
   - Muestra resumen de lo aplicado
   - Indica próximos pasos

---

## 🚀 Pasos para Aplicar la Solución

### Paso 1: Diagnóstico (Opcional pero Recomendado)
```sql
-- 1. Ir a Supabase SQL Editor
-- 2. Abrir DIAGNOSTICO_AUSENCIA_UNICA.sql
-- 3. Copiar y ejecutar TODO el contenido
-- 4. Revisar los resultados
```

**Resultado esperado:**
- Verás qué está faltando
- Confirmarás el diagnóstico

### Paso 2: Aplicar Solución ⭐ **EJECUTAR ESTE**
```sql
-- 1. Ir a Supabase SQL Editor
-- 2. Abrir SOLUCION_AUSENCIA_UNICA_COMPLETA.sql
-- 3. Copiar y ejecutar TODO el contenido
-- 4. Esperar mensaje de éxito
```

**Resultado esperado:**
```
✅ Columna clase_numero agregada/verificada
✅ Datos migrados: X registros
✅ Vista vista_horarios_usuarios creada
✅ Índices creados
✅ SOLUCIÓN APLICADA EXITOSAMENTE
```

### Paso 3: Verificar en la Aplicación
```
1. Refrescar el navegador (F5)
2. Ir a "Mis Clases" como usuario
3. Verificar que las clases canceladas aparecen como "CLASE BLOQUEADA"
4. Abrir la consola del navegador (F12)
5. Ver logs de depuración (ya agregados en el código)
```

**Logs que deberías ver:**
```javascript
🔍 Verificando ausencia única: {
  fechaStr: "2025-10-21",
  fechaAusenciaISO: "2025-10-21",
  claseNumero: 1,
  clases_canceladas: [1],
  coincideFecha: true
}
✅ Bloqueando clase específica: 1
🚫 Clase BLOQUEADA: { fecha: "2025-10-21", claseNumero: 1 }
```

---

## 🔧 Cambios en el Código (Ya Aplicados)

### `RecurringScheduleView.tsx`

He agregado **logs de depuración** en la función `estaClaseBloqueada` para facilitar el diagnóstico:

```typescript:src/components/RecurringScheduleView.tsx
// Función helper para verificar si una fecha+clase está bloqueada por ausencia
const estaClaseBloqueada = (fecha: Date, claseNumero?: number): boolean => {
  const fechaStr = format(fecha, 'yyyy-MM-dd');
  
  const bloqueada = ausenciasAdmin.some(ausencia => {
    // Verificar ausencia única
    if (ausencia.tipo_ausencia === 'unica') {
      // Extraer solo la parte de fecha (YYYY-MM-DD) del string de fecha ISO
      const fechaAusenciaISO = ausencia.fecha_inicio.split('T')[0];
      
      console.log('🔍 Verificando ausencia única:', {
        fechaStr,
        fechaAusenciaISO,
        claseNumero,
        clases_canceladas: ausencia.clases_canceladas,
        coincideFecha: fechaAusenciaISO === fechaStr
      });
      
      // Si la fecha coincide
      if (fechaAusenciaISO === fechaStr) {
        // Si no hay clases_canceladas específicas, se bloquean todas
        if (!ausencia.clases_canceladas || ausencia.clases_canceladas.length === 0) {
          console.log('✅ Bloqueando TODAS las clases (sin clases_canceladas específicas)');
          return true;
        }
        // Si hay clases específicas, verificar si esta clase está en la lista
        if (claseNumero && ausencia.clases_canceladas.includes(claseNumero)) {
          console.log('✅ Bloqueando clase específica:', claseNumero);
          return true;
        }
        console.log('❌ No bloquear: clase', claseNumero, 'no está en la lista');
      }
    }
    
    // Verificar ausencia por período
    if (ausencia.tipo_ausencia === 'periodo') {
      const fechaInicio = ausencia.fecha_inicio.split('T')[0];
      const fechaFin = ausencia.fecha_fin ? ausencia.fecha_fin.split('T')[0] : fechaInicio;
      
      // Si la fecha está dentro del período
      if (fechaStr >= fechaInicio && fechaStr <= fechaFin) {
        console.log('✅ Bloqueando por período:', { fechaStr, fechaInicio, fechaFin });
        return true;
      }
    }
    
    return false;
  });

  if (bloqueada) {
    console.log('🚫 Clase BLOQUEADA:', { fecha: fechaStr, claseNumero });
  }

  return bloqueada;
};
```

**Cambios clave:**
1. ✅ Extrae fecha usando `.split('T')[0]` en lugar de `format(new Date())`
2. ✅ Logs detallados para debugging
3. ✅ Maneja correctamente ausencias con/sin `clases_canceladas`
4. ✅ Compara `claseNumero` correctamente

---

## 📊 Cómo Funciona el Flujo Completo

### Flujo de Ausencia Única (Después de la Solución)

```
1. Admin crea ausencia única (21/10/2025, Clase 1)
   ↓
2. Se guarda en ausencias_admin:
   {
     tipo_ausencia: 'unica',
     fecha_inicio: '2025-10-21T12:00:00',
     clases_canceladas: [1]
   }
   ↓
3. Usuario carga "Mis Clases"
   ↓
4. Se ejecuta cargarAusenciasAdmin()
   - Trae ausencias activas desde BD
   - Se guarda en estado ausenciasAdmin
   ↓
5. Se ejecuta cargarClasesDelMes()
   - Trae horarios desde vista_horarios_usuarios
   - Incluye clase_numero
   ↓
6. Para cada clase del día, se ejecuta estaClaseBloqueada()
   - Compara fecha: '2025-10-21' === '2025-10-21' ✅
   - Compara clase_numero: 1 en [1] ✅
   - Retorna: true
   ↓
7. La clase se marca como bloqueada
   - Se muestra con fondo amarillo
   - Texto: "CLASE BLOQUEADA"
   - No se puede seleccionar
```

### Por Qué Funciona Ausencia Período

**Ausencia por período** no depende de `clase_numero`:
- Solo verifica si la fecha está en el rango
- No necesita la vista
- Por eso funciona correctamente

---

## 🎯 Verificación de Éxito

Después de aplicar la solución, deberías ver:

### ✅ En la Base de Datos
```sql
-- Vista existe
SELECT * FROM vista_horarios_usuarios LIMIT 5;
-- Resultado: 5 registros con clase_numero

-- Horarios tienen clase_numero
SELECT COUNT(*) FROM horarios_recurrentes_usuario WHERE clase_numero IS NOT NULL;
-- Resultado: > 0

-- Ausencias activas
SELECT * FROM ausencias_admin WHERE activo = true;
-- Resultado: tus ausencias creadas
```

### ✅ En la Aplicación (Usuario)
- Al entrar a "Mis Clases"
- Las clases canceladas muestran:
  - Fondo amarillo
  - Texto "CLASE BLOQUEADA"
  - No se pueden seleccionar

### ✅ En la Consola del Navegador
```
🔍 Verificando ausencia única: {...}
✅ Bloqueando clase específica: 1
🚫 Clase BLOQUEADA: { fecha: "2025-10-21", claseNumero: 1 }
```

---

## 🐛 Si Aún No Funciona

### Problema: Vista no se crea
**Solución:**
```sql
-- Verificar permisos
GRANT SELECT ON vista_horarios_usuarios TO authenticated;
GRANT SELECT ON vista_horarios_usuarios TO anon;
```

### Problema: Usuarios no tienen clase_numero
**Solución:**
```sql
-- Ejecutar migración manual
UPDATE horarios_recurrentes_usuario hru
SET clase_numero = hs.clase_numero
FROM horarios_semanales hs
WHERE hru.dia_semana = hs.dia_semana
  AND hru.hora_inicio = hs.hora_inicio
  AND hru.clase_numero IS NULL;
```

### Problema: Logs no aparecen en consola
**Solución:**
- Refrescar la página (F5)
- Abrir consola antes de cargar
- Verificar que no hay filtros activos en consola

---

## 📝 Resumen

**Problema raíz:** Falta vista `vista_horarios_usuarios` + posible falta de `clase_numero`

**Solución:** Ejecutar `SOLUCION_AUSENCIA_UNICA_COMPLETA.sql`

**Resultado:** Ausencias únicas bloquean clases correctamente

**Tiempo de aplicación:** ~2 minutos

**Impacto:** ✅ Sin breaking changes, solo mejoras

---

## 📞 Próximos Pasos

1. ✅ Ejecutar `SOLUCION_AUSENCIA_UNICA_COMPLETA.sql` en Supabase
2. ✅ Refrescar navegador
3. ✅ Probar crear ausencia única
4. ✅ Verificar bloqueo en usuario
5. ✅ Revisar logs en consola
6. ✅ Si todo OK → remover logs de depuración (opcional)

---

**Estado:** 🔧 Solución lista para aplicar  
**Archivos creados:**
- ✅ `DIAGNOSTICO_AUSENCIA_UNICA.sql`
- ✅ `CREAR_VISTA_HORARIOS_USUARIOS.sql`
- ✅ `SOLUCION_AUSENCIA_UNICA_COMPLETA.sql`
- ✅ `VERIFICAR_AUSENCIAS_ADMIN.sql`
- ✅ Este documento de explicación

**Cambios en código:**
- ✅ `src/components/RecurringScheduleView.tsx` (logs agregados)

