import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, body: emailBody, jobId } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Get job info for logging
    let jobInfo = '';
    if (jobId) {
      const job = await prisma.savedJob.findUnique({
        where: { id: jobId },
        select: { title: true, company: true },
      });
      if (job) {
        jobInfo = `${job.title} at ${job.company}`;
      }
    }

    // Create HTML version of the email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .content {
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <div class="content">${emailBody.replace(/\n/g, '<br>')}</div>
      </body>
      </html>
    `;

    // Send the email
    const success = await sendEmail({
      to,
      subject,
      html,
      text: emailBody,
    });

    if (!success) {
      logger.error('system', 'Failed to send job application email', {
        to,
        subject,
        jobId,
        jobInfo,
      });
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // Log successful send
    logger.info('system', `Email sent to ${to}`, {
      to,
      subject,
      jobId,
      jobInfo,
    });

    // Update job notes with last contact date if jobId provided
    if (jobId) {
      try {
        const job = await prisma.savedJob.findUnique({
          where: { id: jobId },
          select: { notes: true },
        });

        const contactNote = `\n\n[Email sent: ${new Date().toLocaleDateString()} - ${subject}]`;
        await prisma.savedJob.update({
          where: { id: jobId },
          data: {
            notes: job?.notes ? job.notes + contactNote : contactNote.trim(),
          },
        });
      } catch {
        // Ignore update errors
      }
    }

    return NextResponse.json({
      success: true,
      message: `Email sent to ${to}`,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
