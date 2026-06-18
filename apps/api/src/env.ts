// Env loading — MUST be imported before any module that reads process.env at
// evaluation time (e.g. db.ts builds the pg Pool from DATABASE_URL). ESM runs
// imports in order, so `import './env'` as the first import guarantees this.
//
// Loads apps/api/.env (production) first, then falls back to the monorepo root
// .env for local dev. dotenv does not override already-set vars, so the
// service-local file takes precedence.

import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

loadEnv();
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });
