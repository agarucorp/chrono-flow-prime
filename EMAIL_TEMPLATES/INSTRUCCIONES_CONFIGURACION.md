# Configuración de Plantillas de Email en Supabase

## 📧 Plantillas de Email Personalizadas

Este documento explica cómo configurar las plantillas de email en Supabase para que coincidan con el estilo del sitio MaldaGym.

---

## 🎨 Paleta de Colores del Sitio

```css
Color Primario (Naranja): #FB8500 / hsl(25 95% 53%)
Color Primario Claro: #FFB347 / hsl(25 95% 63%)
Texto Oscuro: #2d3748 / hsl(220 8% 15%)
Texto Claro: #ffffff
Fondo: #f5f5f5
```

---

## 🔧 Pasos para Configurar en Supabase

### 1. Acceder al Dashboard de Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Email Templates**

### 2. Configurar la Plantilla de Confirmación de Cuenta

1. Selecciona **"Confirm signup"**
2. Copia el contenido de `confirmacion_cuenta.html`
3. Pega en el editor de **HTML Template**
4. En **Subject**, escribe: `Confirma tu cuenta en MaldaGym`
5. Haz clic en **Save**

### 3. Configurar la Plantilla de Recuperación de Contraseña

1. Selecciona **"Reset password"**
2. Copia el contenido de `recuperacion_contraseña.html`
3. Pega en el editor de **HTML Template**
4. En **Subject**, escribe: `Recupera tu contraseña - MaldaGym`
5. Haz clic en **Save**

---

## 📋 Variables Disponibles en Supabase

Las siguientes variables están disponibles en las plantillas de email:

- `{{ .ConfirmationURL }}` - URL de confirmación/reset
- `{{ .Token }}` - Token de confirmación
- `{{ .TokenHash }}` - Hash del token
- `{{ .SiteURL }}` - URL del sitio
- `{{ .Email }}` - Email del usuario

---

## ✨ Características de las Plantillas

### Confirmación de Cuenta
✅ Header con gradiente naranja
✅ Botón de confirmación destacado
✅ Caja de información con tiempo de expiración
✅ Enlace alternativo si el botón no funciona
✅ Footer con información del sitio
✅ Responsive para mobile

### Recuperación de Contraseña
✅ Header con gradiente naranja
✅ Botón de restablecimiento
✅ Caja de advertencia de seguridad
✅ Enlace alternativo
✅ Footer con información del sitio
✅ Responsive para mobile

---

## 🎯 Elementos de Diseño

### Header
- Gradiente naranja (#FB8500 → #FFB347)
- Texto blanco
- Fuente: Open Sans Bold

### Botones
- Gradiente naranja
- Sombra con color primario
- Hover effect con elevación
- Border radius: 8px
- Padding: 16px 40px

### Cajas de Información
- Borde izquierdo naranja (4px)
- Fondo: #fff7ed
- Texto: #92400e

### Cajas de Advertencia
- Borde izquierdo rojo (4px)
- Fondo: #fef2f2
- Texto: #991b1b

---

## 📱 Responsive

Las plantillas están optimizadas para:
- Desktop (600px)
- Tablet (< 600px)
- Mobile (< 480px)

Ajustes automáticos:
- Padding reducido en mobile
- Fuentes más pequeñas
- Botones de ancho completo
- Mejor legibilidad

---

## 🔒 Seguridad

- ✅ Tiempo de expiración mostrado claramente
- ✅ Advertencia si no solicitó el cambio
- ✅ Enlaces seguros
- ✅ Sin información sensible expuesta

---

## 🧪 Testing

Para probar las plantillas:

1. Crea una cuenta de prueba
2. Verifica que el email llegue con el estilo correcto
3. Prueba el botón de confirmación
4. Prueba el enlace alternativo
5. Verifica en diferentes clientes de email:
   - Gmail
   - Outlook
   - Apple Mail
   - Mobile

---

## 📝 Notas Importantes

1. **Supabase tarda unos minutos** en aplicar los cambios de plantillas
2. **Siempre prueba** las plantillas antes de usar en producción
3. **Mantén una copia** de las plantillas fuera de Supabase
4. **Verifica** que las variables {{ }} se reemplacen correctamente

---

## 🎨 Personalización Adicional

Si necesitas agregar el logo del gimnasio:

1. Sube el logo a un servidor público (ej: Supabase Storage)
2. Agrega en el header:
```html
<img src="URL_DEL_LOGO" alt="Logo" style="max-width: 200px; height: auto; margin-bottom: 20px;">
```

---

## 📞 Soporte

Si tienes problemas con la configuración:
- Revisa la documentación de Supabase Auth
- Verifica que las variables estén correctas
- Prueba con diferentes clientes de email

---

✅ **¡Listo! Las plantillas ya tienen el estilo del sitio.**
