// Email (nodemailer) — ported from the web app's src/lib/email.ts. The API
// service owns this Node-only library after the split (the web copy is removed
// once its /api/* routes are deleted in Phase 4). Only the functions the ported
// routes need live here; more are added as further domains are ported.

import nodemailer from 'nodemailer';

function createTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
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

export async function sendContactNotification(
  senderName: string,
  senderEmail: string,
  subject: string | null,
  message: string,
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
