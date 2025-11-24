# Template Email Confirmación - Supabase

## Configuración en Supabase Dashboard

Ve a: **Authentication > Email Templates > Confirm your signup**

## HTML del Template:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px;" cellpadding="0" cellspacing="0">
          
          <!-- CTA Principal -->
          <tr>
            <td style="padding: 50px 30px; background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%); border: 2px solid #3a3a3a; border-radius: 12px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
              
              <p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 35px 0;">
                Gracias por registrarte en MaldaGym. Confirmá tu cuenta para poder iniciar sesión en la plataforma.
              </p>
              
              <a href="{{ .ConfirmationURL }}" 
                 style="display: inline-block; background-color: #ffffff !important; color: #000000 !important; text-decoration: none; padding: 16px 36px; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; text-align: center; min-width: 200px; border: 1px solid #e0e0e0 !important;">
                Confirmar email
              </a>
              
            </td>
          </tr>
          
          <!-- Link alternativo -->
          <tr>
            <td style="padding: 25px 20px; text-align: center;">
              <p style="color: #888; font-size: 12px; line-height: 18px; margin: 0;">
                Si no funciona el botón, copiá y pegá este enlace en tu navegador:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #b0b0b0; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 0; text-align: center; border-top: 1px solid #333;">
              <p style="color: #666; font-size: 11px; line-height: 16px; margin: 0;">
                Si no intentaste registrarte, ignorá este mensaje.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Subject Line (Asunto):

```
Confirmá tu cuenta en MaldaGym
```

## Configuración Adicional:

### En Supabase Dashboard:

1. Ve a **Authentication > Settings > Email Auth**
2. Asegúrate de que "Enable email confirmations" esté activado
3. Ve a **Authentication > Settings > Email Templates**
4. Selecciona "Confirm your signup"
5. Pega el HTML arriba en el campo "Email body"
6. Copia el Subject Line arriba en "Subject"
7. Guarda los cambios

### Variables disponibles en Supabase:

- `{{ .ConfirmationURL }}` - El link único de confirmación
- `{{ .Token }}` - El token de confirmación (para links custom)
- `{{ .TokenHash }}` - Hash del token
- `{{ .SiteURL }}` - URL de tu sitio

### Testing:

Para probar el template:
1. Regístrate con un email de prueba
2. Revisa el email recibido
3. Ajusta estilos si es necesario

---

# Template Email Recuperación de Contraseña - Supabase

## Configuración en Supabase Dashboard

Ve a: **Authentication > Email Templates > Reset password**

## HTML del Template:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px;" cellpadding="0" cellspacing="0">
          
          <!-- CTA Principal -->
          <tr>
            <td style="padding: 50px 30px; background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%); border: 2px solid #3a3a3a; border-radius: 12px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
              
              <p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 35px 0;">
                Recibimos una solicitud para restablecer tu contraseña de MaldaGym. Tocá el botón para crear una nueva.
              </p>
              
              <a href="{{ .ConfirmationURL }}" 
                 style="display: inline-block; background-color: #ffffff; color: #1a1a1a; text-decoration: none; padding: 16px 36px; border-radius: 8px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-align: center; min-width: 220px; box-shadow: 0 4px 16px rgba(255,255,255,0.2);">
                Recuperar<br>contraseña
              </a>
              
            </td>
          </tr>
          
          <!-- Link alternativo -->
          <tr>
            <td style="padding: 25px 20px; text-align: center;">
              <p style="color: #888; font-size: 12px; line-height: 18px; margin: 0;">
                Si no funciona el botón, copiá y pegá este enlace en tu navegador:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #b0b0b0; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 0; text-align: center; border-top: 1px solid #333;">
              <p style="color: #666; font-size: 11px; line-height: 16px; margin: 0;">
                Si no solicitaste este cambio, ignorá este mensaje.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Subject Line (Asunto):

```
Restablecé tu contraseña en MaldaGym
```

## Configuración:

1. Ve a **Authentication > Email Templates**
2. Selecciona "Reset password"
3. Pega el HTML arriba en el campo "Email body"
4. Copia el Subject Line arriba en "Subject"
5. Guarda los cambios

