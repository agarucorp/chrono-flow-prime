# Implementación de Balance Automático

## ✅ Casos Cubiertos Automáticamente

### 1. **Registro de Usuario**
- **Cuándo**: Usuario se registra por primera vez
- **Impacto**: Solo se cobran clases desde `fecha_inicio` de sus horarios recurrentes
- **Función**: `fn_recalcular_cuota_mensual` considera `fecha_inicio`
- **Trigger**: No aplica (es calculo inicial)

### 2. **Cancelación de Clase (Usuario)**
- **Cuándo**: Usuario cancela una clase propia
- **Impacto**: Se recalcula su cuota
  - Si es tardía (< 24hs): se cobra
  - Si es anticipada: no se cobra
- **Función**: `fn_recalcular_cuota_mensual`
- **Trigger**: `trigger_recalcular_cuotas_cancelacion` → recalcula cuota del usuario

### 3. **Ausencias del Admin**
- **Cuándo**: Admin crea/modifica/elimina ausencias (única o período)
- **Impacto**: Se descuentan automáticamente las clases bloqueadas
- **Función**: `fn_recalcular_cuota_mensual` (excluye días con ausencias)
- **Trigger**: 
  - `trigger_recalcular_cuotas_ausencias_admin_insert`
  - `trigger_recalcular_cuotas_ausencias_admin_update`
  - `trigger_recalcular_cuotas_ausencias_admin_delete`
  - → Recalculan cuotas de **todos** los usuarios afectados

### 4. **Turnos Asignados por el Admin**
- **Cuándo**: Admin asigna un turno variable a un usuario
- **Impacto**: Se suma 1 clase a la cuota del usuario
- **Función**: `fn_recalcular_cuota_mensual` (cuenta turnos_variables)
- **Trigger**: 
  - `trigger_recalcular_cuotas_turnos_variables_insert`
  - `trigger_recalcular_cuotas_turnos_variables_update`
  - `trigger_recalcular_cuotas_turnos_variables_delete`
  - → Recalcula cuota del usuario afectado

### 5. **Remoción de Turno por el Admin**
- **Cuándo**: Admin elimina un turno variable de un usuario
- **Impacto**: Se resta 1 clase de la cuota del usuario
- **Función**: `fn_recalcular_cuota_mensual`
- **Trigger**: `trigger_recalcular_cuotas_turnos_variables_delete`
  - → Recalcula cuota del usuario afectado

## 📊 Cálculo de Cuotas

La función `fn_recalcular_cuota_mensual` ahora calcula:

```
clases_a_cobrar = 
  clases_recurrentes (considera fecha_inicio, excluye ausencias admin) +
  clases_variables (excluye días con ausencias admin) -
  clases_canceladas_tardia -
  clases_canceladas_anticipacion
```

### Detalles:
- **clases_recurrentes**: Cuenta días del mes donde el usuario tiene horario, desde su fecha de registro
- **Excluye**: Días con ausencias del admin
- **clases_variables**: Cuenta turnos variables confirmados del usuario
- **Excluye**: Turnos en días con ausencias del admin
- **Cancelaciones**: Se restan según tipo (tardía vs anticipada)

## 🔄 Flujo Automático

```
Evento (INSERT/UPDATE/DELETE)
    ↓
Trigger detecta cambio
    ↓
Ejecuta función de recálculo
    ↓
Consulta:
  - Horarios recurrentes del usuario
  - Turnos variables del usuario
  - Ausencias del admin
  - Cancelaciones del usuario
    ↓
Calcula clases_a_cobrar
    ↓
Actualiza tabla cuotas_mensuales
    ↓
Balance automáticamente actualizado ✅
```

## 🎯 Estado Actual

✅ **Registro de usuario**: Considera fecha_inicio
✅ **Cancelaciones**: Se restan correctamente
✅ **Ausencias del admin**: Impactan en balance automáticamente
✅ **Turnos asignados/removidos**: Recalculan balance automáticamente
⏳ **Frontend**: Pendiente filtrar clases previas a fecha_inicio en "Mis clases"

## 🧪 Pruebas de Validación

Para verificar que todo funciona:

1. **Registro nuevo usuario**:
   - Usuario registrado el 15 de octubre
   - Debe tener clases solo desde 15 en adelante
   - Cuota debe reflejar clases reales

2. **Admin crea ausencia**:
   - Ausencia del 28 al 30 de octubre
   - Cuotas de usuarios deben recalcularse automáticamente
   - Esas fechas no deben contabilizarse

3. **Admin asigna turno**:
   - Admin asigna turno variable a usuario
   - Cuota del usuario debe aumentar automáticamente
   - Se refleja en balance inmediatamente

4. **Admin remueve turno**:
   - Admin elimina turno variable de usuario
   - Cuota del usuario debe disminuir automáticamente
   - Se refleja en balance inmediatamente

5. **Usuario cancela clase**:
   - Cancela con anticipación: no se cobra
   - Cancela tarde (< 24hs): se cobra
   - Cuota se recalcula automáticamente

