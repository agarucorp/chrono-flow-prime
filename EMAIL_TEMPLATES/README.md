# 📧 Plantillas de Email Personalizadas

## 🎨 Estilo del Sitio Aplicado

Las plantillas de email han sido diseñadas para coincidir perfectamente con la colorimetría y estilo de **MaldaGym**.

---

## 📁 Archivos Incluidos

### Plantillas HTML
- `confirmacion_cuenta.html` - Email de confirmación de registro
- `recuperacion_contraseña.html` - Email de recuperación de contraseña

### Plantillas de Texto Plano
- `confirmacion_cuenta.txt` - Versión texto sin HTML
- `recuperacion_contraseña.txt` - Versión texto sin HTML

### Documentación
- `INSTRUCCIONES_CONFIGURACION.md` - Guía paso a paso
- `VERIFICAR_CONFIGURACION_EMAIL.sql` - Scripts de verificación

---

## 🎨 Paleta de Colores

```
🟠 Color Primario: #FB8500 (Naranja vibrante)
🟡 Color Secundario: #FFB347 (Naranja claro)
⚫ Texto Oscuro: #2d3748
⚪ Texto Claro: #ffffff
🔲 Fondo: #f5f5f5
```

---

## ✨ Características

### ✅ Diseño Profesional
- Header con gradiente naranja del sitio
- Botones con efecto hover y sombra
- Cajas de información con borde naranja
- Footer con información completa
- Responsive para mobile

### ✅ Experiencia de Usuario
- Mensajes claros y amigables
- Emojis para mejor lectura
- Tiempos de expiración visibles
- Enlaces alternativos por si el botón no funciona
- Advertencias de seguridad

### ✅ Compatibilidad
- Funciona en Gmail, Outlook, Apple Mail
- Responsive para dispositivos móviles
- Versiones HTML y texto plano
- Estilos inline para máxima compatibilidad

---

## 📋 Cómo Configurar

### Opción 1: Dashboard de Supabase (Recomendado)

1. **Ir al Dashboard**
   - https://supabase.com/dashboard
   - Selecciona tu proyecto
   - Authentication → Email Templates

2. **Configurar "Confirm signup"**
   - Copia el contenido de `confirmacion_cuenta.html`
   - Pega en el editor HTML
   - Subject: `Confirma tu cuenta en MaldaGym`
   - Guardar

3. **Configurar "Reset password"**
   - Copia el contenido de `recuperacion_contraseña.html`
   - Pega en el editor HTML
   - Subject: `Recupera tu contraseña - MaldaGym`
   - Guardar

### Opción 2: API de Supabase

También puedes configurar las plantillas via API o CLI de Supabase.

---

## 🧪 Testing

### Antes de producción, verifica:

- [ ] Email de confirmación llega correctamente
- [ ] Estilos se muestran como esperado
- [ ] Botón de confirmación funciona
- [ ] Enlace alternativo funciona
- [ ] Se ve bien en Gmail
- [ ] Se ve bien en Outlook
- [ ] Se ve bien en mobile
- [ ] Versión texto plano funciona

---

## 📱 Vista Previa

### Email de Confirmación
```
┌─────────────────────────────────┐
│   [Gradiente Naranja]           │
│   ¡Bienvenido! 🎉              │
└─────────────────────────────────┘
│                                 │
│   Confirma tu cuenta            │
│                                 │
│   Hola,                         │
│   Gracias por registrarte...    │
│                                 │
│   ┌───────────────────────┐    │
│   │  Confirmar mi cuenta  │    │
│   └───────────────────────┘    │
│   [Botón naranja con sombra]    │
│                                 │
│   ┌─────────────────────────┐  │
│   │ ⏰ Importante:          │  │
│   │ Expira en 24 horas      │  │
│   └─────────────────────────┘  │
│                                 │
│   ─────────────────────────────│
│   MaldaGym            │
│   © 2025                        │
└─────────────────────────────────┘
```

---

## 🎯 Próximos Pasos

1. **Configurar plantillas** en Supabase Dashboard
2. **Enviar email de prueba** usando el botón "Send test email"
3. **Verificar** que llegue con el estilo correcto
4. **Probar** el flujo completo de registro
5. **Documentar** cualquier ajuste necesario

---

## 💡 Tips

- **Gmail**: Soporta bien CSS inline
- **Outlook**: Limitado en CSS, usa tablas
- **Apple Mail**: Excelente soporte de CSS
- **Mobile**: Usa media queries responsivas

**Siempre prueba** en múltiples clientes antes de activar en producción.

---

## 📞 Soporte

Si necesitas ayuda con la configuración:
- 📖 [Documentación de Supabase Auth](https://supabase.com/docs/guides/auth)
- 📖 [Personalización de Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

---

✅ **¡Las plantillas están listas para usar!**

Las plantillas ahora reflejan el mismo estilo moderno y profesional del sitio, con la colorimetría naranja característica de MaldaGym.
