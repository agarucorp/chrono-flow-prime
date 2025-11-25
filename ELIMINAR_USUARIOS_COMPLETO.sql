-- =====================================================
-- SCRIPT PARA ELIMINAR USUARIOS DE PRUEBA COMPLETAMENTE
-- Incluye eliminación de historial y todas las referencias
-- =====================================================
-- 
-- USUARIOS A ELIMINAR (usuarios de prueba):
-- - ruiztonytr@gmail.com
-- - gastonaccenture@gmail.com
-- - fede.rz87@gmail.com
-- - versmax04@gmail.com
-- - belgranosuplementos@gmail.com
-- - gastondigilio@gmail.com
-- - federico.ruizmachado@gmail.com
--
-- INSTRUCCIONES:
-- 1. Este script está LISTO PARA EJECUTAR
-- 2. Ejecuta directamente en el SQL Editor de Supabase
-- 3. El script eliminará todos los usuarios listados y su historial completo
--
-- ADVERTENCIA: Esta operación es IRREVERSIBLE
-- El script NO afecta ninguna funcionalidad del sitio, solo elimina usuarios de prueba
-- =====================================================

-- =====================================================
-- OPCIÓN 1: Eliminar UN usuario por EMAIL
-- =====================================================
-- (Comentado - usar Opción 2 para eliminar múltiples usuarios)

/*
DO $$
DECLARE
    user_id UUID;
    user_email TEXT := 'EMAIL_DEL_USUARIO'; -- ⚠️ CAMBIAR AQUÍ
BEGIN
    -- Obtener el ID del usuario por email
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado con email: %', user_email;
    END IF;
    
    RAISE NOTICE 'Eliminando usuario: % (ID: %)', user_email, user_id;
    
    -- =====================================================
    -- ELIMINAR DATOS DE TABLAS RELACIONADAS
    -- (En orden para evitar violaciones de foreign keys)
    -- Solo eliminar de tablas que existen
    -- IMPORTANTE: Eliminar primero las tablas que referencian a otras
    -- =====================================================
    
    -- 1. Eliminar turnos variables que referencian turnos_disponibles (si existen ambas tablas)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_variables') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_disponibles') THEN
            DELETE FROM public.turnos_variables 
            WHERE cliente_id = user_id 
            AND creado_desde_disponible_id IS NOT NULL
            AND creado_desde_disponible_id IN (
                SELECT id FROM public.turnos_disponibles 
                WHERE creado_desde_cancelacion_id IN (
                    SELECT id FROM public.turnos_cancelados WHERE cliente_id = user_id
                )
            );
        END IF;
        -- Eliminar el resto de turnos variables del usuario
        DELETE FROM public.turnos_variables WHERE cliente_id = user_id;
        RAISE NOTICE '✓ Eliminados turnos variables';
    END IF;
    
    -- 2. Eliminar turnos disponibles que fueron creados desde cancelaciones (si existe la tabla)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_disponibles') THEN
        DELETE FROM public.turnos_disponibles 
        WHERE creado_desde_cancelacion_id IN (
            SELECT id FROM public.turnos_cancelados WHERE cliente_id = user_id
        );
        RAISE NOTICE '✓ Eliminados turnos disponibles relacionados';
    END IF;
    
    -- 3. Eliminar turnos cancelados (después de eliminar todas las referencias)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_cancelados') THEN
        DELETE FROM public.turnos_cancelados WHERE cliente_id = user_id;
        RAISE NOTICE '✓ Eliminados turnos cancelados';
    END IF;
    
    -- 3. Eliminar reservas de turnos (si existe la tabla)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservas_turnos') THEN
        DELETE FROM public.reservas_turnos WHERE cliente_id = user_id;
        RAISE NOTICE '✓ Eliminadas reservas de turnos';
    END IF;
    
    -- 4. Eliminar horarios recurrentes del usuario (si existe la tabla)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'horarios_recurrentes_usuario') THEN
        DELETE FROM public.horarios_recurrentes_usuario WHERE usuario_id = user_id;
        RAISE NOTICE '✓ Eliminados horarios recurrentes';
    END IF;
    
    -- 5. Eliminar cuotas mensuales (si existe la tabla)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cuotas_mensuales') THEN
        DELETE FROM public.cuotas_mensuales WHERE usuario_id = user_id;
        RAISE NOTICE '✓ Eliminadas cuotas mensuales';
    END IF;
    
    -- 6. Eliminar perfil (si existe la tabla)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        DELETE FROM public.profiles WHERE id = user_id;
        RAISE NOTICE '✓ Eliminado perfil';
    END IF;
    
    -- 7. Eliminar usuario de autenticación (auth.users siempre existe)
    DELETE FROM auth.users WHERE id = user_id;
    RAISE NOTICE '✓ Eliminado usuario de autenticación';
    
    RAISE NOTICE '✅ Usuario eliminado completamente: %', user_email;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error al eliminar usuario: %', SQLERRM;
END $$;
*/

-- =====================================================
-- OPCIÓN 2: Eliminar MÚLTIPLES usuarios por EMAIL
-- =====================================================
-- USUARIOS DE PRUEBA A ELIMINAR (descomenta para ejecutar):

DO $$
DECLARE
    user_id UUID;
    user_email TEXT;
    emails TEXT[] := ARRAY[
        'ruiztonytr@gmail.com',
        'gastonaccenture@gmail.com',
        'fede.rz87@gmail.com',
        'versmax04@gmail.com',
        'belgranosuplementos@gmail.com',
        'gastondigilio@gmail.com',
        'federico.ruizmachado@gmail.com'
    ];
    usuarios_eliminados INT := 0;
    usuarios_no_encontrados INT := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIANDO ELIMINACIÓN DE USUARIOS DE PRUEBA';
    RAISE NOTICE 'Total de usuarios a eliminar: %', array_length(emails, 1);
    RAISE NOTICE '========================================';
    
    FOREACH user_email IN ARRAY emails
    LOOP
        RAISE NOTICE 'Buscando usuario: %', user_email;
        
        -- Obtener el ID del usuario por email
        SELECT id INTO user_id 
        FROM auth.users 
        WHERE LOWER(email) = LOWER(user_email);
        
        IF user_id IS NULL THEN
            RAISE NOTICE '⚠ Usuario no encontrado en auth.users: %', user_email;
            
            -- Intentar buscar en profiles por si acaso
            SELECT id INTO user_id 
            FROM public.profiles 
            WHERE LOWER(email) = LOWER(user_email);
            
            IF user_id IS NOT NULL THEN
                RAISE NOTICE '  → Usuario encontrado en profiles pero no en auth.users: % (ID: %)', user_email, user_id;
                RAISE NOTICE '  → Esto puede indicar un problema de sincronización';
            END IF;
            
            usuarios_no_encontrados := usuarios_no_encontrados + 1;
            CONTINUE;
        END IF;
        
        RAISE NOTICE '  → Usuario encontrado: % (ID: %)', user_email, user_id;
        
        RAISE NOTICE '';
        RAISE NOTICE '----------------------------------------';
        RAISE NOTICE 'Eliminando usuario: % (ID: %)', user_email, user_id;
        RAISE NOTICE '----------------------------------------';
        
        -- Eliminar datos relacionados (en orden para evitar violaciones de foreign keys)
        -- Solo eliminar de tablas que existen
        -- IMPORTANTE: Eliminar primero las tablas que referencian a otras
        
        -- 1. Eliminar turnos variables que referencian turnos_disponibles (si existen ambas tablas)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_variables') THEN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_disponibles') THEN
                DELETE FROM public.turnos_variables 
                WHERE cliente_id = user_id 
                AND creado_desde_disponible_id IS NOT NULL
                AND creado_desde_disponible_id IN (
                    SELECT id FROM public.turnos_disponibles 
                    WHERE creado_desde_cancelacion_id IN (
                        SELECT id FROM public.turnos_cancelados WHERE cliente_id = user_id
                    )
                );
            END IF;
            -- Eliminar el resto de turnos variables del usuario
            DELETE FROM public.turnos_variables WHERE cliente_id = user_id;
            RAISE NOTICE '  ✓ Eliminados turnos variables';
        END IF;
        
        -- 2. Eliminar turnos disponibles que fueron creados desde cancelaciones (si existe la tabla)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_disponibles') THEN
            DELETE FROM public.turnos_disponibles 
            WHERE creado_desde_cancelacion_id IN (
                SELECT id FROM public.turnos_cancelados WHERE cliente_id = user_id
            );
            RAISE NOTICE '  ✓ Eliminados turnos disponibles relacionados';
        END IF;
        
        -- 3. Eliminar turnos cancelados (después de eliminar todas las referencias)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_cancelados') THEN
            DELETE FROM public.turnos_cancelados WHERE cliente_id = user_id;
            RAISE NOTICE '  ✓ Eliminados turnos cancelados';
        END IF;
        
        -- 3. Eliminar reservas de turnos (si existe la tabla)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservas_turnos') THEN
            DELETE FROM public.reservas_turnos WHERE cliente_id = user_id;
            RAISE NOTICE '  ✓ Eliminadas reservas de turnos';
        END IF;
        
        -- 4. Eliminar horarios recurrentes del usuario (si existe la tabla)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'horarios_recurrentes_usuario') THEN
            DELETE FROM public.horarios_recurrentes_usuario WHERE usuario_id = user_id;
            RAISE NOTICE '  ✓ Eliminados horarios recurrentes';
        END IF;
        
        -- 5. Eliminar cuotas mensuales (si existe la tabla)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cuotas_mensuales') THEN
            DELETE FROM public.cuotas_mensuales WHERE usuario_id = user_id;
            RAISE NOTICE '  ✓ Eliminadas cuotas mensuales';
        END IF;
        
        -- 6. Eliminar perfil (si existe la tabla)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
            DELETE FROM public.profiles WHERE id = user_id;
            GET DIAGNOSTICS filas_eliminadas = ROW_COUNT;
            IF filas_eliminadas > 0 THEN
                RAISE NOTICE '  ✓ Eliminado perfil (% filas)', filas_eliminadas;
            ELSE
                RAISE NOTICE '  ⚠ No se encontró perfil para eliminar';
            END IF;
        END IF;
        
        -- 7. Eliminar usuario de autenticación
        DELETE FROM auth.users WHERE id = user_id;
        GET DIAGNOSTICS filas_eliminadas = ROW_COUNT;
        
        IF filas_eliminadas > 0 THEN
            RAISE NOTICE '  ✓ Eliminado usuario de autenticación (% filas)', filas_eliminadas;
            RAISE NOTICE '✅ Usuario eliminado completamente: %', user_email;
            usuarios_eliminados := usuarios_eliminados + 1;
        ELSE
            RAISE NOTICE '  ⚠ No se pudo eliminar el usuario de autenticación (puede que ya no exista)';
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DE ELIMINACIÓN';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Usuarios eliminados: %', usuarios_eliminados;
    RAISE NOTICE 'Usuarios no encontrados: %', usuarios_no_encontrados;
    RAISE NOTICE 'Total procesados: %', array_length(emails, 1);
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Proceso completado';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error durante la eliminación: %', SQLERRM;
END $$;

-- =====================================================
-- OPCIÓN 3: Eliminar por ID directamente
-- =====================================================
-- Si conoces el ID del usuario, puedes usar esto:

/*
DO $$
DECLARE
    user_id UUID := 'UUID_DEL_USUARIO'; -- ⚠️ CAMBIAR AQUÍ
BEGIN
    -- Verificar que el usuario existe
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id) THEN
        RAISE EXCEPTION 'Usuario no encontrado con ID: %', user_id;
    END IF;
    
    RAISE NOTICE 'Eliminando usuario con ID: %', user_id;
    
    -- Eliminar datos relacionados (solo de tablas que existen)
    -- IMPORTANTE: Eliminar primero las tablas que referencian a otras
    -- 1. Eliminar turnos variables que referencian turnos_disponibles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_variables') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_disponibles') THEN
            DELETE FROM public.turnos_variables 
            WHERE cliente_id = user_id 
            AND creado_desde_disponible_id IS NOT NULL
            AND creado_desde_disponible_id IN (
                SELECT id FROM public.turnos_disponibles 
                WHERE creado_desde_cancelacion_id IN (
                    SELECT id FROM public.turnos_cancelados WHERE cliente_id = user_id
                )
            );
        END IF;
        -- Eliminar el resto de turnos variables
        DELETE FROM public.turnos_variables WHERE cliente_id = user_id;
    END IF;
    -- 2. Eliminar turnos disponibles que referencian turnos_cancelados
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_disponibles') THEN
        DELETE FROM public.turnos_disponibles 
        WHERE creado_desde_cancelacion_id IN (
            SELECT id FROM public.turnos_cancelados WHERE cliente_id = user_id
        );
    END IF;
    -- 3. Eliminar turnos cancelados después de eliminar todas las referencias
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turnos_cancelados') THEN
        DELETE FROM public.turnos_cancelados WHERE cliente_id = user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservas_turnos') THEN
        DELETE FROM public.reservas_turnos WHERE cliente_id = user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'horarios_recurrentes_usuario') THEN
        DELETE FROM public.horarios_recurrentes_usuario WHERE usuario_id = user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cuotas_mensuales') THEN
        DELETE FROM public.cuotas_mensuales WHERE usuario_id = user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        DELETE FROM public.profiles WHERE id = user_id;
    END IF;
    DELETE FROM auth.users WHERE id = user_id;
    
    RAISE NOTICE '✅ Usuario eliminado completamente';
END $$;
*/

-- =====================================================
-- VERIFICACIÓN: Ver usuarios antes de eliminar
-- =====================================================
-- Ejecuta esto primero para ver qué usuarios existen:

/*
SELECT 
    u.id,
    u.email,
    u.created_at,
    p.full_name,
    p.role,
    p.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;
*/

