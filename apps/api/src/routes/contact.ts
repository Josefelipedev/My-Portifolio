// Contact route — ported from the web app's src/app/api/contact/route.ts POST
// handler. Public (unauthenticated) but protected by honeypot, optional
// Turnstile verification, and an in-memory rate limit. Reuses the API's Node
// libs (email/nodemailer, rate-limit).

import { Hono } from 'hono';
import prisma from '../db';
import { sendContactNotification } from '../lib/email';
import { checkContactRateLimit, recordContactAttempt, getClientIp } from '../lib/rate-limit';

const contact = new Hono();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const badRequest = (message: string) => ({ error: message, code: 'BAD_REQUEST' });

contact.post('/contact', async (c) => {
  const ip = getClientIp(c.req.raw.headers);

  if (!checkContactRateLimit(ip).allowed) {
    return c.json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const { name, email, subject, message, honeypot, turnstileToken } = body;

  // Spam honeypot: pretend success without giving bots a hint.
  if (honeypot) return c.json({ success: true });

  // Optional Cloudflare Turnstile verification.
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!turnstileToken) return c.json(badRequest('Verificação de segurança necessária'), 400);
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: String(turnstileToken),
        remoteip: ip,
      }),
    });
    const data = (await verify.json()) as { success?: boolean };
    if (!data.success) return c.json(badRequest('Falha na verificação de segurança'), 400);
  }

  // Validation (parity with validateMinLength / validateEmail).
  if (typeof name !== 'string' || name.trim().length < 2) {
    return c.json(badRequest('Name must be at least 2 characters'), 400);
  }
  if (typeof email !== 'string' || !emailRegex.test(email)) {
    return c.json(badRequest('Valid email is required'), 400);
  }
  if (typeof message !== 'string' || message.trim().length < 10) {
    return c.json(badRequest('Message must be at least 10 characters'), 400);
  }

  recordContactAttempt(ip);

  const cleanSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : null;
  const contactMessage = await prisma.contactMessage.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: cleanSubject,
      message: message.trim(),
    },
  });

  // Fire-and-forget notification (don't block the response on email failure).
  sendContactNotification(name.trim(), email.trim().toLowerCase(), cleanSubject, message.trim()).catch(
    (err) => console.error('Failed to send contact notification:', err),
  );

  return c.json({
    success: true,
    message: 'Your message has been sent successfully!',
    id: contactMessage.id,
  });
});

export default contact;
