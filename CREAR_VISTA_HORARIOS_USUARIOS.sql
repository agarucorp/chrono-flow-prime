-- CREAR VISTA PARA COMBINAR HORARIOS DE USUARIOS CON HORAS ACTUALIZADAS
-- Esta vista permite que los usuarios vean siempre las horas actualizadas de sus clases
-- incluso cuando el admin cambia los horarios desde el panel

-- 1. Eliminar vista si existe
DROP VIEW IF EXISTS vista_horarios_usuarios;

-- 2. Crear vista que combina horarios_recurrentes_usuario con horarios_semanales
CREATE OR REPLACE VIEW vista_horarios_usuarios AS
SELECT 
  hru.id,
  hru.usuario_id,
  hru.dia_semana,
  hru.clase_numero,
  COALESCE(hs.hora_inicio, hru.hora_inicio) as hora_inicio,
  COALESCE(hs.hora_fin, hru.hora_fin) as hora_fin,
  hru.activo,
  CONCAT('Clase ', hru.clase_numero) as nombre_clase,
  hs.capacidad,
  hru.combo_aplicado,
  hru.tarifa_personalizada
FROM horarios_recurrentes_usuario hru
LEFT JOIN horarios_semanales hs 
  ON hs.dia_semana = hru.dia_semana 
  AND hs.clase_numero = hru.clase_numero
  AND hs.activo = true
WHERE hru.activo = true;

-- 3. Dar permisos a la vista
GRANT SELECT ON vista_horarios_usuarios TO authenticated;
GRANT SELECT ON vista_horarios_usuarios TO anon;

-- 4. Habilitar RLS en la vista (hereda las políticas de las tablas base)
ALTER VIEW vista_horarios_usuarios SET (security_invoker = true);

-- 5. Verificar que la vista se creó correctamente
SELECT 
  'Vista creada exitosamente' as resultado,
  COUNT(*) as total_registros
FROM vista_horarios_usuarios;

-- 6. Mostrar algunos registros de ejemplo
SELECT 
  usuario_id,
  dia_semana,
  clase_numero,
  hora_inicio,
  hora_fin,
  nombre_clase,
  activo
FROM vista_horarios_usuarios
LIMIT 10;

