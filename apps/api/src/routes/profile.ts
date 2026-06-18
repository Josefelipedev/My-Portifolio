// Public profile route — ported from the web app's src/app/api/profile/route.ts
// GET handler. Returns the public SiteConfig fields only (no secrets); response
// matches @portfolio/shared's siteConfigResponseSchema.

import { Hono } from 'hono';
import prisma from '../db';

const profile = new Hono();

// Public-safe fields only — never expose secrets (wakatimeConfig, jobApiKeys).
const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  title: true,
  bio: true,
  avatarUrl: true,
  githubUrl: true,
  linkedinUrl: true,
  twitterUrl: true,
  email: true,
  location: true,
} as const;

profile.get('/profile', async (c) => {
  const data = await prisma.siteConfig.findUnique({
    where: { id: 'main' },
    select: PUBLIC_PROFILE_SELECT,
  });
  return c.json({ success: true, data });
});

export default profile;
