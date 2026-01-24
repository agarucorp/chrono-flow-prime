# Configurar Supabase con Resend (reemplazar SendGrid)

El trial de SendGrid venció el 29/12/2025. Resend en plan **Free** da **3.000 emails/mes** y **100/día** gratis.

---

## 1. Resend – Verificar que esté listo

Ya tenés:
- Dominio `maldagym.com` verificado (DKIM, Enable Sending ON)
- API key tipo "Onboarding" con **Sending access** (`re_...`)

Si no tenés la API key a mano:
1. [Resend → API Keys](https://resend.com/api-keys)
2. Crear una nueva con **Sending access** o usar la existente
3. Copiar la clave (solo se muestra una vez; si la perdiste, creá otra)

---

## 2. Supabase – SMTP con Resend

1. Ir a **[Supabase](https://supabase.com/dashboard)** → tu proyecto → **Authentication** → **Providers** → **Email** (o **Settings** → **SMTP**).
2. En **SMTP Settings**:
   - **Enable Custom SMTP**: dejar **ON**
   - **Sender email:** `noreply@maldagym.com` (ya lo tenés)
   - **Sender name:** `MaldaGym`

3. En **SMTP provider settings**, reemplazar SendGrid por Resend:

   | Campo      | Valor actual (SendGrid) | Valor nuevo (Resend)   |
   |------------|-------------------------|------------------------|
   | **Host**   | `smtp.sendgrid.net`     | `smtp.resend.com`      |
   | **Port**   | `587`                   | `465`                  |
   | **Username** | (SendGrid user)       | `resend`               |
   | **Password** | (SendGrid API key)    | **Tu API key de Resend** (`re_...`) |

4. **Guardar** cambios.

---

## 3. Probar

1. En Supabase: **Authentication** → **Users** → **Invite user** (o probar registro desde tu app).
2. Verificar que llegue el email de confirmación.
3. En **Resend → Usage**: deberías ver **1 / 3,000** (o similar) en envíos.

---

## 4. Límites Resend Free

- **3.000 emails / mes**
- **100 emails / día**
- Sin tarjeta para el plan Free

Si superás el límite, Resend devolverá error y Supabase puede mostrar 500 al intentar enviar el email de confirmación. En ese caso, revisar Usage en Resend o hacer upgrade.

---

## Resumen rápido

```
Host:     smtp.resend.com
Port:     465
Username: resend
Password: [Tu API key de Resend re_...]
Sender:   noreply@maldagym.com
```

Después de cambiar esto, Supabase usará **solo Resend** para los emails de auth (confirmación, reset password, etc.). SendGrid ya no se usa.
