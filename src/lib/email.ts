import nodemailer from 'nodemailer';

// Create transporter based on environment
function createTransporter() {
  // For production, use SMTP settings from environment
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // For development/testing, use ethereal or console
  console.warn('SMTP not configured. Emails will be logged to console.');
  return null;
}

const transporter = createTransporter();

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  try {
    if (!transporter) {
      // Log to console in development
      console.log('\n========== EMAIL ==========');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Content: ${text || html}`);
      console.log('===========================\n');
      return true;
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@portfolio.com',
      to,
      subject,
      html,
      text,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendVerificationCode(email: string, code: string, name: string): Promise<boolean> {
  const subject = `Seu código de verificação: ${code}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; padding: 20px; }
        .warning { font-size: 12px; color: #666; margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; }
        h1 { color: #1f2937; font-size: 24px; margin-bottom: 10px; }
        p { color: #4b5563; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Olá, ${name}!</h1>
        <p>Você está tentando fazer login no seu portfolio. Use o código abaixo para confirmar:</p>
        <div class="code">${code}</div>
        <p>Este código expira em <strong>10 minutos</strong>.</p>
        <div class="warning">
          ⚠️ Se você não solicitou este código, ignore este email. Alguém pode estar tentando acessar sua conta.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Olá ${name}!\n\nSeu código de verificação é: ${code}\n\nEste código expira em 10 minutos.\n\nSe você não solicitou este código, ignore este email.`;

  return sendEmail({ to: email, subject, html, text });
}

export async function sendLoginAlert(
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string,
  timestamp: Date
): Promise<boolean> {
  const subject = '🔐 Novo login detectado na sua conta';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .info { background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .info-row { display: flex; margin: 8px 0; }
        .info-label { color: #64748b; width: 80px; }
        .info-value { color: #1e293b; font-weight: 500; }
        h1 { color: #1f2937; font-size: 24px; margin-bottom: 10px; }
        p { color: #4b5563; line-height: 1.6; }
        .warning { font-size: 12px; color: #666; margin-top: 20px; padding: 15px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Novo login detectado</h1>
        <p>Olá ${name}, detectamos um novo login na sua conta:</p>
        <div class="info">
          <div class="info-row">
            <span class="info-label">IP:</span>
            <span class="info-value">${ipAddress}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Data:</span>
            <span class="info-value">${timestamp.toLocaleString('pt-BR')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Device:</span>
            <span class="info-value">${userAgent.substring(0, 50)}...</span>
          </div>
        </div>
        <div class="warning">
          Se não foi você, acesse imediatamente o painel admin e altere sua senha.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}
