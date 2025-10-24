// Script para enviar emails masivos usando Resend
// Instalar: npm install resend

import { Resend } from 'resend';

const resend = new Resend('re_123456789'); // Reemplazar con tu API key de Resend

const emailData = {
  from: 'Chrono Flow <noreply@chronoflow.com>',
  to: ['versmax04@gmail.com'],
  subject: 'Recordatorio de Pago - Noviembre 2025',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .amount { font-size: 24px; font-weight: bold; color: #2d3748; margin: 20px 0; }
        .details { background: #f7fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .footer { background: #2d3748; color: white; padding: 20px; text-align: center; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Chrono Flow</h1>
          <p>Recordatorio de Pago Mensual</p>
        </div>
        <div class="content">
          <h2>Hola Max Verstappen,</h2>
          <p>Te recordamos que tienes un pago pendiente para el mes de <strong>Noviembre 2025</strong>.</p>
          
          <div class="details">
            <h3>Resumen de tu cuota mensual:</h3>
            <p><strong>Valor por clase:</strong> $10,000 ARS</p>
            <p><strong>Clases programadas:</strong> 5 clases</p>
            <p><strong>Descuento aplicado:</strong> 0%</p>
            <div class="amount">Total a pagar: $50,000 ARS</div>
          </div>
          
          <p>Por favor, realiza el pago antes del 1 de noviembre para mantener tu acceso a las clases.</p>
        </div>
        <div class="footer">
          <p>Chrono Flow - Sistema de Gestión de Clases</p>
          <p>Este es un email automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `
};

async function enviarEmail() {
  try {
    const { data, error } = await resend.emails.send(emailData);
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

enviarEmail();
