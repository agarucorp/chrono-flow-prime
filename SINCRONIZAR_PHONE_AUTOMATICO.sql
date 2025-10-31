-- Crear función RPC para sincronizar phone desde auth.users a profiles
-- Ejecutar en Supabase SQL Editor

CREATE OR REPLACE FUNCTION sync_phones_from_auth()
RETURNS JSON AS $$
DECLARE
  updated_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Sincronizar phone, first_name, last_name desde auth.users a profiles
  FOR user_record IN 
    SELECT 
      au.id,
      au.raw_user_meta_data->>'phone' as phone,
      au.raw_user_meta_data->>'first_name' as first_name,
      au.raw_user_meta_data->>'last_name' as last_name
    FROM auth.users au
    JOIN profiles p ON p.id = au.id
    WHERE 
      (p.phone IS NULL OR p.phone = '')
      AND au.raw_user_meta_data->>'phone' IS NOT NULL
      AND au.raw_user_meta_data->>'phone' != ''
  LOOP
    UPDATE profiles
    SET 
      phone = user_record.phone,
      first_name = COALESCE(first_name, user_record.first_name),
      last_name = COALESCE(last_name, user_record.last_name),
      updated_at = NOW()
    WHERE id = user_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', 'Phones synchronized successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar la función una vez para sincronizar datos existentes
SELECT sync_phones_from_auth();

