# ✅ IMPLEMENTACIÓN: Cambio de Horarios y Planes para Usuarios

## 📋 Resumen

Se ha implementado la funcionalidad completa para que los usuarios puedan modificar sus horarios y planes después de la configuración inicial.

---

## 🎯 Funcionalidades Implementadas

### 1. **Visualización de Horarios Actuales en Perfil**
- ✅ Sección agregada en `ProfileSettingsDialog` que muestra:
  - Plan actual del usuario (Plan 1, Plan 2, etc.)
  - Días de la semana con sus horarios configurados
  - Horarios con formato visual (badges con iconos)
- ✅ Disponible tanto en vista móvil como desktop
- ✅ Botón "Cambiar horarios" para iniciar el proceso de modificación

### 2. **Modal de Cambio de Horarios (`ChangeScheduleModal`)**
- ✅ Componente nuevo basado en `RecurringScheduleModal` pero adaptado para cambios
- ✅ Pre-selecciona los horarios actuales del usuario
- ✅ Permite cambiar el plan (1-5 días)
- ✅ Permite modificar horarios manteniendo o cambiando el plan
- ✅ Verifica capacidad de clases antes de permitir selección
- ✅ Excluye los horarios actuales del usuario al verificar capacidad (permite mantener horarios actuales)

### 3. **Verificación de Capacidad**
- ✅ **RecurringScheduleModal**: Actualizado para usar capacidad por clase (`horarios_semanales.capacidad`) en lugar de capacidad global
- ✅ **ChangeScheduleModal**: Verifica capacidad excluyendo los horarios actuales del usuario
- ✅ Bloquea clases que están al 100% de capacidad
- ✅ Muestra indicadores visuales (botones deshabilitados, mensajes) cuando una clase está llena

### 4. **Actualización de Base de Datos**
- ✅ Al cambiar horarios:
  1. Elimina todos los horarios antiguos del usuario
  2. Inserta los nuevos horarios seleccionados
  3. Actualiza `combo_asignado` y `tarifa_personalizada` en `profiles`
  4. Genera cuota mensual automáticamente para el mes actual

### 5. **Actualización de Vistas**
- ✅ Dispara eventos para actualizar todas las vistas:
  - `horariosRecurrentes:updated` - Actualiza "Mis Clases"
  - `balance:refresh` - Actualiza balance del usuario
  - `clasesDelMes:updated` - Actualiza clases del mes
  - `alumnosHorarios:updated` - Actualiza vista admin de usuarios
  - `turnosVariables:updated` - Actualiza agenda admin

---

## 📁 Archivos Modificados/Creados

### Nuevos Archivos:
1. **`src/components/ChangeScheduleModal.tsx`**
   - Modal completo para cambiar horarios y plan
   - Reutiliza lógica de `RecurringScheduleModal` pero adaptado para cambios
   - Pre-selecciona horarios actuales
   - Verifica capacidad excluyendo horarios actuales del usuario

2. **`VERIFICAR_COLUMNAS_HORARIOS_RECURRENTES.sql`**
   - Script para verificar y agregar columnas necesarias (`combo_aplicado`, `tarifa_personalizada`, `clase_numero`)

3. **`VERIFICAR_Y_CAMBIAR_PLAN_USUARIO.sql`**
   - Script para verificar y cambiar manualmente el plan del usuario fede.rz87@gmail.com

### Archivos Modificados:
1. **`src/components/ProfileSettingsDialog.tsx`**
   - Agregada sección de "Plan y horarios"
   - Carga y muestra horarios actuales del usuario
   - Botón "Cambiar horarios" que abre `ChangeScheduleModal`
   - Integración completa con el nuevo modal

2. **`src/components/RecurringScheduleModal.tsx`**
   - Actualizado para usar capacidad por clase (`item.capacidad`) en lugar de capacidad global
   - Bloquea clases llenas en el registro inicial
   - Verifica capacidad correctamente antes de permitir selección

---

## 🔄 Flujo de Cambio de Horarios

### Paso 1: Usuario accede al perfil
1. Usuario hace click en su avatar → "Configurar Perfil"
2. Se abre `ProfileSettingsDialog`
3. Se cargan y muestran los horarios actuales

### Paso 2: Usuario inicia cambio
1. Usuario hace click en "Cambiar horarios"
2. Se abre `ChangeScheduleModal` con:
   - Plan actual pre-seleccionado
   - Horarios actuales pre-seleccionados

### Paso 3: Usuario modifica
1. Puede cambiar el plan (1-5 días)
2. Puede mantener o cambiar horarios
3. El sistema verifica capacidad antes de permitir selección
4. Clases llenas aparecen bloqueadas (excepto las que ya tiene el usuario)

### Paso 4: Confirmación
1. Usuario revisa cambios
2. Confirma → Se actualiza la base de datos
3. Se disparan eventos para actualizar todas las vistas
4. Modal se cierra y perfil se actualiza

---

## 🗄️ Estructura de Base de Datos

### Tabla `horarios_recurrentes_usuario`:
- `usuario_id` - ID del usuario
- `dia_semana` - Día de la semana (1-5)
- `clase_numero` - Número de clase
- `hora_inicio` / `hora_fin` - Horarios
- `combo_aplicado` - Plan seleccionado (1-5)
- `tarifa_personalizada` - Tarifa por clase
- `activo` - Si está activo

### Tabla `profiles`:
- `combo_asignado` - Plan actual del usuario
- `tarifa_personalizada` - Tarifa por clase actual

### Tabla `horarios_semanales`:
- `capacidad` - Capacidad por clase (no global)
- `clase_numero` - Número de clase
- `dia_semana` - Día de la semana

---

## ✅ Verificaciones Implementadas

1. **Capacidad por Clase**: 
   - Cada clase tiene su propia capacidad en `horarios_semanales.capacidad`
   - Se verifica antes de permitir selección
   - Se excluyen los horarios actuales del usuario al verificar capacidad

2. **Validación de Plan**:
   - El usuario debe seleccionar exactamente la cantidad de horarios según su plan
   - No puede seleccionar más horarios que días en su plan

3. **Actualización Completa**:
   - Todos los horarios antiguos se eliminan
   - Se insertan los nuevos horarios
   - Se actualiza el plan y tarifa en `profiles`
   - Se generan cuotas automáticamente

---

## 🧪 Pruebas Recomendadas

### Test 1: Cambio de Plan
1. Usuario con Plan 2 (2 días)
2. Cambiar a Plan 3 (3 días)
3. Seleccionar 3 horarios nuevos
4. Verificar que se actualiza en:
   - Perfil del usuario
   - "Mis Clases"
   - Balance
   - Panel admin (lista de usuarios)
   - Agenda admin

### Test 2: Cambio de Horarios Manteniendo Plan
1. Usuario con Plan 3
2. Mantener Plan 3
3. Cambiar solo los horarios (mismo número de días)
4. Verificar que se actualiza correctamente

### Test 3: Clases Llenas
1. Intentar seleccionar una clase que está al 100% de capacidad
2. Verificar que aparece bloqueada
3. Verificar que el usuario puede mantener su horario actual incluso si la clase está llena

### Test 4: Usuario fede.rz87@gmail.com
1. Verificar plan actual
2. Cambiar plan y horarios
3. Verificar impacto en todas las vistas
4. Revertir al plan original

---

## 📝 Notas Importantes

1. **Capacidad por Clase**: El sistema ahora usa la capacidad específica de cada clase, no una capacidad global. Esto permite que diferentes clases tengan diferentes límites de alumnos.

2. **Exclusión de Horarios Actuales**: Al verificar capacidad, se excluyen los horarios actuales del usuario, permitiendo que mantenga sus horarios incluso si la clase está llena para otros usuarios.

3. **Eventos de Actualización**: Se disparan múltiples eventos para asegurar que todas las vistas se actualicen correctamente después de un cambio.

4. **Generación de Cuotas**: Las cuotas mensuales se regeneran automáticamente después de cambiar horarios para reflejar el nuevo plan.

---

## 🚀 Estado de Implementación

✅ **Completado:**
- Visualización de horarios en perfil
- Modal de cambio de horarios
- Verificación de capacidad por clase
- Actualización de base de datos
- Eventos para actualizar vistas
- Bloqueo de clases llenas

⏳ **Pendiente de Prueba:**
- Flujo completo con usuario real
- Verificación de impacto en todas las vistas
- Prueba con usuario fede.rz87@gmail.com
