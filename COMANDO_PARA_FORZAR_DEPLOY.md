# 🚀 COMANDOS PARA FORZAR DEPLOY

## 📝 Ejecutar estos comandos en la terminal:

```bash
# 1. Agregar los cambios al staging
git add .

# 2. Crear commit con mensaje descriptivo
git commit -m "fix: Critical fix for RecurringScheduleModal - Removed horario_clase_id and created_at from insert (VERSION 2025-01-12T16:00:00Z)"

# 3. Hacer push al branch Develop2
git push origin Develop2
```

## ⏱️ Después del push:

1. **Esperar deploy de Vercel** (2-5 minutos)
   - Ir a: https://vercel.com/dashboard
   - Ver el nuevo deployment
   - Esperar a que diga "Ready"

2. **Limpiar caché del navegador:**
   - Presionar: `Ctrl + Shift + R` (o `Cmd + Shift + R` en Mac)
   - O cerrar TODAS las pestañas del sitio y volver a abrir

3. **Verificar en consola (F12):**
   - Abrir popup de horarios
   - Buscar: `🔥 RecurringScheduleModal VERSION: 2025-01-12T16:00:00Z`
   - Si NO aparece → Limpiar caché más agresivamente

---

## 🔄 Si necesitas probar AHORA (sin esperar deploy):

```bash
# 1. Instalar dependencias (solo si no lo hiciste antes)
npm install

# 2. Ejecutar en modo desarrollo
npm run dev

# 3. Abrir navegador en:
# http://localhost:5173
```

El modo desarrollo actualiza el código automáticamente sin necesidad de hacer deploy.
