import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  checkContactRateLimit,
  recordContactAttempt,
  getClientIP,
} from '@/lib/rate-limit';
import {
  success,
  error,
  Errors,
  validateEmail,
  validateMinLength,
} from '@/lib/api-utils';
import { sendContactNotification } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);

    // Check rate limit
    const rateLimit = checkContactRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, subject, message, honeypot, turnstileToken } = body;

    // Spam detection: if honeypot field is filled, reject silently
    if (honeypot) {
      // Return success to not give hints to bots
      return success({ success: true });
    }

    // Validate Turnstile token
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        throw Errors.BadRequest('Verificação de segurança necessária');
      }

      const turnstileResponse = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
            remoteip: ip,
          }),
        }
      );

      const turnstileData = await turnstileResponse.json();

      if (!turnstileData.success) {
        throw Errors.BadRequest('Falha na verificação de segurança');
      }
    }

    // Validation
    validateMinLength(name, 2, 'Name');

    if (!email || !validateEmail(email)) {
      throw Errors.BadRequest('Valid email is required');
    }

    validateMinLength(message, 10, 'Message');

    // Record the attempt
    recordContactAttempt(ip);

    // Save to database
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject?.trim() || null,
        message: message.trim(),
      },
    });

    // Send email notification (don't block on failure)
    sendContactNotification(
      name.trim(),
      email.trim().toLowerCase(),
      subject?.trim() || null,
      message.trim()
    ).catch((err) => {
      console.error('Failed to send contact notification:', err);
    });

    return success({
      success: true,
      message: 'Your message has been sent successfully!',
      id: contactMessage.id,
    });
  } catch (err) {
    return error(err);
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
