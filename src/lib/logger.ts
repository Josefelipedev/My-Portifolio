// System Logger - Centralized logging with database persistence

import prisma from './prisma';
import type { Prisma } from '@prisma/client';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LogSource =
  | 'geekhunter'
  | 'vagascombr'
  | 'python-scraper'
  | 'remoteok'
  | 'remotive'
  | 'arbeitnow'
  | 'adzuna'
  | 'jooble'
  | 'jsearch'
  | 'netempregos'
  | 'linkedin'
  | 'ai-extraction'
  | 'job-enrichment'
  | 'job-alerts'
  | 'finduniversity'
  | 'api'
  | 'auth'
  | 'cron'
  | 'system';

interface LogDetails {
  error?: string;
  stack?: string;
  request?: {
    url?: string;
    method?: string;
    params?: Record<string, unknown>;
  };
  response?: {
    status?: number;
    body?: unknown;
  };
  duration?: number;
  count?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: LogDetails;
}

class Logger {
  private queue: LogEntry[] = [];
  private isProcessing = false;
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds

  constructor() {
    // Start periodic flush
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.flush(), this.flushInterval);
    }
  }

  private async flush(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await prisma.systemLog.createMany({
        data: batch.map((entry) => ({
          level: entry.level,
          source: entry.source,
          message: entry.message,
          details: entry.details
            ? (JSON.parse(JSON.stringify(entry.details)) as Prisma.InputJsonValue)
            : undefined,
        })),
      });
    } catch (err) {
      // If database write fails, log to console and re-queue
      console.error('[Logger] Failed to write logs to database:', err);
      this.queue.unshift(...batch);
    } finally {
      this.isProcessing = false;
    }
  }

  private log(entry: LogEntry): void {
    // Always log to console
    const consoleMethod = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
    const prefix = `[${entry.level.toUpperCase()}] [${entry.source}]`;
    console[consoleMethod](prefix, entry.message, entry.details || '');

    // Queue for database persistence
    this.queue.push(entry);

    // Immediate flush for errors
    if (entry.level === 'error') {
      this.flush();
    }
  }

  error(source: LogSource, message: string, details?: LogDetails): void {
    this.log({ level: 'error', source, message, details });
  }

  warn(source: LogSource, message: string, details?: LogDetails): void {
    this.log({ level: 'warn', source, message, details });
  }

  info(source: LogSource, message: string, details?: LogDetails): void {
    this.log({ level: 'info', source, message, details });
  }

  debug(source: LogSource, message: string, details?: LogDetails): void {
    // Only log debug in development
    if (process.env.NODE_ENV === 'development') {
      this.log({ level: 'debug', source, message, details });
    }
  }

  // Helper to log scraper results
  scraperResult(
    source: LogSource,
    success: boolean,
    count: number,
    duration: number,
    error?: Error
  ): void {
    if (success) {
      this.info(source, `Found ${count} jobs`, { count, duration });
    } else {
      this.error(source, `Scraping failed: ${error?.message || 'Unknown error'}`, {
        error: error?.message,
        stack: error?.stack,
        duration,
      });
    }
  }

  // Force immediate flush (useful before process exit)
  async forceFlush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.flush();
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export helper functions for convenience
export const logError = (source: LogSource, message: string, details?: LogDetails) =>
  logger.error(source, message, details);

export const logWarn = (source: LogSource, message: string, details?: LogDetails) =>
  logger.warn(source, message, details);

export const logInfo = (source: LogSource, message: string, details?: LogDetails) =>
  logger.info(source, message, details);

export const logDebug = (source: LogSource, message: string, details?: LogDetails) =>
  logger.debug(source, message, details);

export const logScraperResult = (
  source: LogSource,
  success: boolean,
  count: number,
  duration: number,
  error?: Error
) => logger.scraperResult(source, success, count, duration, error);
