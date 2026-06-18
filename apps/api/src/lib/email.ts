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

export async function sendContactNotification(
  senderName: string,
  senderEmail: string,
  subject: string | null,
  message: string
): Promise<boolean> {
  const contactEmail = process.env.CONTACT_EMAIL;

  if (!contactEmail) {
    console.warn('CONTACT_EMAIL not configured. Skipping notification.');
    return false;
  }

  const emailSubject = `📬 Nova mensagem: ${subject || 'Sem assunto'}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; margin: -40px -40px 30px; padding: 30px 40px; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 20px; }
        .info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .info-row { margin: 8px 0; }
        .info-label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { color: #1e293b; font-weight: 500; margin-top: 4px; }
        .message { background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .message-content { color: #1e293b; line-height: 1.6; white-space: pre-wrap; }
        .reply-btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📬 Nova mensagem do portfolio</h1>
        </div>

        <div class="info">
          <div class="info-row">
            <div class="info-label">De</div>
            <div class="info-value">${senderName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Email</div>
            <div class="info-value">${senderEmail}</div>
          </div>
          ${subject ? `
          <div class="info-row">
            <div class="info-label">Assunto</div>
            <div class="info-value">${subject}</div>
          </div>
          ` : ''}
        </div>

        <div class="message">
          <div class="message-content">${message}</div>
        </div>

        <a href="mailto:${senderEmail}?subject=Re: ${subject || 'Contato via Portfolio'}" class="reply-btn">
          Responder
        </a>
      </div>
    </body>
    </html>
  `;

  const text = `Nova mensagem do portfolio\n\nDe: ${senderName}\nEmail: ${senderEmail}\nAssunto: ${subject || 'Sem assunto'}\n\nMensagem:\n${message}`;

  return sendEmail({ to: contactEmail, subject: emailSubject, html, text });
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

export async function sendScraperAlert(
  scraperName: string,
  keyword: string,
  jobsFound: number,
  errorMessage?: string
): Promise<boolean> {
  const alertEmail = process.env.ALERT_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER;

  if (!alertEmail) {
    console.warn('ALERT_EMAIL not configured. Skipping scraper alert.');
    return false;
  }

  const isError = jobsFound === 0 || !!errorMessage;
  const subject = isError
    ? `⚠️ Scraper Alert: ${scraperName} - No jobs found`
    : `✅ Scraper Success: ${scraperName} - ${jobsFound} jobs`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: ${isError ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'linear-gradient(135deg, #22c55e, #3b82f6)'}; color: white; margin: -40px -40px 30px; padding: 30px 40px; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 20px; }
        .info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .info-row { margin: 8px 0; }
        .info-label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { color: #1e293b; font-weight: 500; margin-top: 4px; }
        .error-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; color: #991b1b; }
        .action { margin-top: 20px; padding: 15px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isError ? '⚠️ Scraper Alert' : '✅ Scraper Success'}</h1>
        </div>

        <div class="info">
          <div class="info-row">
            <div class="info-label">Scraper</div>
            <div class="info-value">${scraperName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Keyword</div>
            <div class="info-value">${keyword}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Jobs Found</div>
            <div class="info-value">${jobsFound}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Time</div>
            <div class="info-value">${new Date().toLocaleString('pt-BR')}</div>
          </div>
        </div>

        ${errorMessage ? `
        <div class="error-box">
          <strong>Error:</strong> ${errorMessage}
        </div>
        ` : ''}

        ${isError ? `
        <div class="action">
          <strong>Ação recomendada:</strong> Os seletores CSS do scraper podem estar desatualizados.
          Verifique os arquivos de debug (screenshot e HTML) no painel admin para identificar as mudanças no site.
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;

  const text = `Scraper Alert: ${scraperName}\n\nKeyword: ${keyword}\nJobs Found: ${jobsFound}\nTime: ${new Date().toLocaleString('pt-BR')}\n${errorMessage ? `\nError: ${errorMessage}` : ''}`;

  return sendEmail({ to: alertEmail, subject, html, text });
}
