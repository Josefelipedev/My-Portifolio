// Minimal logger shim for the API service. The web app's logger persists to a
// SystemLog DB table; the API service only needs the console-backed surface that
// the ported jobs scrapers (geekhunter, vagas) rely on. Same call signature:
// logger.<level>(source, message, details?).

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

type LogDetails = Record<string, unknown>;

function emit(level: LogLevel, source: string, message: string, details?: LogDetails): void {
  const line = `[${source}] ${message}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (details) fn(line, details);
  else fn(line);
}

export const logger = {
  error: (source: string, message: string, details?: LogDetails) => emit('error', source, message, details),
  warn: (source: string, message: string, details?: LogDetails) => emit('warn', source, message, details),
  info: (source: string, message: string, details?: LogDetails) => emit('info', source, message, details),
  debug: (source: string, message: string, details?: LogDetails) => emit('debug', source, message, details),
};
