import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase - Proyecto real
const supabaseUrl = 'https://bihqdptdkgdfztufrmlm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaHFkcHRka2dkZnp0dWZybWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MjQzODAsImV4cCI6MjA3MjUwMDM4MH0.MK6KTQmWLT60qNMoik4Em7KmeaOA3efoUb2rJtNoH7I'

// Verificar configuración
console.log('🔗 Conectando a Supabase:', supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce'
  }
})

// Tipos para la autenticación
export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}
