# Configuración de Supabase para Gestion Turnos

## Pasos para configurar Supabase

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Anota la URL del proyecto y la clave anónima

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con:

```bash
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima
```

### 3. Configurar autenticación en Supabase

1. En el dashboard de Supabase, ve a **Authentication** > **Settings**
2. Habilita **Email confirmations** si quieres verificación de email
3. Configura las URLs de redirección en **Site URL** y **Redirect URLs**

### 4. Crear tablas en la base de datos

Ejecuta estos SQL en el editor SQL de Supabase:

```sql
-- Tabla de usuarios extendida
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Función para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 5. Uso en el código

```tsx
import { useAuthContext } from './contexts/AuthContext'

function MyComponent() {
  const { user, signIn, signOut } = useAuthContext()
  
  if (user) {
    return (
      <div>
        <p>Hola, {user.email}</p>
        <button onClick={signOut}>Cerrar sesión</button>
      </div>
    )
  }
  
  return <p>No has iniciado sesión</p>
}
```

### 6. Protección de rutas

```tsx
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthForm />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}
```

## Funcionalidades implementadas

- ✅ Autenticación con email/password
- ✅ Registro de usuarios
- ✅ Inicio de sesión
- ✅ Cierre de sesión
- ✅ Reset de contraseña
- ✅ Protección de rutas
- ✅ Contexto global de autenticación
- ✅ Hook personalizado useAuth
- ✅ Manejo de estados de carga y errores

## Próximos pasos

1. Configurar roles de usuario (admin, profesional, cliente)
2. Implementar perfiles de usuario
3. Agregar autenticación social (Google, Facebook)
4. Configurar políticas de seguridad más avanzadas
5. Implementar auditoría de acciones
