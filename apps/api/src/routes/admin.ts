// Admin route group — establishes the authenticated-route pattern for the API
// service. Every /api/admin/* route requires a valid session (requireAuth);
// state-changing methods additionally require CSRF (requireCsrf). Future admin
// domains (projects/skills/experiences/education mutations, jobs, ai, …) mount
// their handlers here and inherit both guards.

import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';

const admin = new Hono<AuthEnv>();

admin.use('/admin/*', requireAuth);
admin.use('/admin/*', requireCsrf);

// Whoami — proves the authenticated context (userId stashed by requireAuth).
admin.get('/admin/me', (c) => c.json({ userId: c.get('userId') }));

// Sample mutation — exercises the CSRF guard on top of auth.
admin.post('/admin/ping', (c) => c.json({ ok: true, userId: c.get('userId') }));

export default admin;
