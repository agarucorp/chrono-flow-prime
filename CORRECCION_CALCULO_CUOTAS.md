# Corrección del Cálculo de Cuotas Mensuales

## Problema Identificado

El usuario Max Verstappen se registró el **21 de octubre de 2025**, pero el sistema le estaba contabilizando todas las clases del mes desde el día 1, incluyendo las semanas anteriores a su registro.

### Datos Realimentados por la Consulta:
- `fecha_inicio` de horarios recurrentes: **2025-10-21**
- Clases previstas en octubre antes de corrección: 23 días
- Clases previstas en octubre **desde fecha de registro**: 9 clases
- Cuota recalculada correctamente: $90,000 (9 clases × $10,000)

## Cambios Implementados

### 1. Corrección de `fn_clases_previstas_mes`
La función ahora considera `fecha_inicio` y `fecha_fin` de los horarios recurrentes:
```sql
and (hru.fecha_inicio IS NULL OR dn.fecha >= hru.fecha_inicio)
and (hru.fecha_fin IS NULL OR dn.fecha <= hru.fecha_fin)
```

### 2. Corrección de `fn_recalcular_cuota_mensual`
La función ahora:
- Separa correctamente `clases_recurrentes` y `clases_variables`
- Considera `fecha_inicio` al contar clases recurrentes
- Suma correctamente: `clases_a_cobrar = recurrentes + variables - canceladas`

### 3. Puntos Pendientes para el Frontend

#### RecurringScheduleView.tsx - `cargarClasesDelMes`
**Línea 505-508**: Agregar filtro por `fecha_inicio` cuando se generan `clasesDelMes`:
```typescript
for (const dia of diasDelMes) {
  // Filtrar clases antes de fecha_inicio
  if (dia < new Date(fechaInicioUsuario)) continue;
  
  const clasesDelDia = await getClasesDelDia(dia, horariosActuales);
  todasLasClases.push(...clasesDelDia);
}
```

**Línea 493-501**: Incluir `fecha_inicio` en la consulta:
```typescript
const { data: horariosDB } = await supabase
  .from('vista_horarios_usuarios')
  .select('id, dia_semana, clase_numero, hora_inicio, hora_fin, activo, fecha_inicio, usuario_id')
  .eq('usuario_id', user.id)
```

#### RecurringScheduleView.tsx - `getClasesDelDia`
**Línea 572-616**: Filtrar por `fecha_inicio` cuando procesa cada día:
```typescript
const getClasesDelDia = async (dia: Date, horariosParaUsar?: HorarioRecurrente[]) => {
  const diaSemana = dia.getDay();
  const horariosAFiltrar = horariosParaUsar || horariosRecurrentes;
  
  // Filtrar por fecha_inicio
  const horariosDelDia = horariosAFiltrar.filter(horario => {
    if (horario.dia_semana !== diaSemana) return false;
    
    // Si tiene fecha_inicio, verificar que el día sea >= fecha_inicio
    if (horario.fecha_inicio) {
      const fechaInicio = new Date(horario.fecha_inicio);
      fechaInicio.setHours(0, 0, 0, 0);
      const diaTurno = new Date(dia);
      diaTurno.setHours(0, 0, 0, 0);
      
      if (diaTurno < fechaInicio) return false;
    }
    
    return true;
  });
  
  // ... resto del código
};
```

## Resultado Final
✅ Balance: Cuotas ahora se calculan desde la fecha de registro del usuario
✅ Backend: Funciones SQL corregidas para considerar `fecha_inicio`
⏳ Frontend: Pendiente actualizar filtros en RecurringScheduleView.tsx

## Próximos Pasos
1. Actualizar interfaz `HorarioRecurrente` para incluir `fecha_inicio`
2. Modificar `cargarClasesDelMes` para filtrar días previos al registro
3. Modificar `getClasesDelDia` para filtrar horarios por fecha_inicio
4. Verificar que las clases canceladas se resten correctamente del balance

