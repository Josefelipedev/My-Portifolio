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
    const { name, email, subject, message, honeypot } = body;

    // Spam detection: if honeypot field is filled, reject silently
    if (honeypot) {
      // Return success to not give hints to bots
      return success({ success: true });
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
