// Public profile route — ported from the web app's src/app/api/profile/route.ts
// GET handler. Returns the public SiteConfig fields only (no secrets); response
// matches @portfolio/shared's siteConfigResponseSchema.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import { getGitHubProfileReadme, type GitHubProfile } from '../lib/github-profile';
import { getGitHubStats, type GitHubStats } from '../lib/github-stats';

const profile = new Hono<AuthEnv>();

// In-memory cache for the public GitHub profile bundle. The homepage hits this
// on every (dynamic) render; GitHub data changes slowly and the aggregation
// fans out to many GitHub calls, so cache it for an hour. Stale data is served
// while a refresh fails, so a transient GitHub error never blanks the section.
const GITHUB_CACHE_TTL_MS = 60 * 60 * 1000;
let githubProfileCache: { at: number; data: GitHubProfileBundle } | null = null;

interface GitHubProfileBundle {
  user: GitHubProfile['user'] | null;
  readme: string;
  stats: GitHubStats | null;
}

async function loadGitHubProfileBundle(): Promise<GitHubProfileBundle> {
  const [profileData, stats] = await Promise.all([
    getGitHubProfileReadme(),
    getGitHubStats(),
  ]);
  return {
    user: profileData?.user ?? null,
    readme: profileData?.content ?? '',
    stats,
  };
}

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

// GET /profile/github — public bundle of the live GitHub profile (README + user)
// and aggregated stats, for the homepage About + GitHub Stats sections. Served
// from here (not the Cloudflare edge) so the GitHub calls use the VPS token and
// IP instead of hitting the unauthenticated edge rate limit. Cached in memory.
profile.get('/profile/github', async (c) => {
  const now = Date.now();
  if (githubProfileCache && now - githubProfileCache.at < GITHUB_CACHE_TTL_MS) {
    return c.json({ success: true, data: githubProfileCache.data });
  }

  const data = await loadGitHubProfileBundle();
  // Only cache a successful fetch; on failure fall back to the last good bundle
  // so a transient GitHub hiccup doesn't blank the homepage.
  if (data.user || data.stats) {
    githubProfileCache = { at: now, data };
    return c.json({ success: true, data });
  }
  if (githubProfileCache) {
    return c.json({ success: true, data: githubProfileCache.data });
  }
  return c.json({ success: true, data });
});

// GET /profile/sync — current SiteConfig + a snapshot of the GitHub profile for
// comparison. Authenticated (admin profile page). Ported from the web's
// src/app/api/profile/sync/route.ts.
profile.get('/profile/sync', requireAuth, async (c) => {
  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: 'main' } });
  const githubData = await getGitHubProfileReadme();
  return c.json({
    siteConfig,
    githubData: githubData
      ? {
          name: githubData.user.name,
          login: githubData.user.login,
          avatar: githubData.user.avatar,
          bio: githubData.user.bio,
          location: githubData.user.location,
          email: githubData.user.email,
          company: githubData.user.company,
          blog: githubData.user.blog,
          hasReadme: !!githubData.content,
        }
      : null,
  });
});

// POST /profile/sync — pull the GitHub profile and upsert it into SiteConfig.
profile.post('/profile/sync', requireAuth, requireCsrf, async (c) => {
  const githubData = await getGitHubProfileReadme();
  if (!githubData) {
    return c.json({ error: 'Failed to fetch GitHub profile data (check GITHUB_TOKEN)' }, 502);
  }

  const { user } = githubData;
  const siteConfig = await prisma.siteConfig.upsert({
    where: { id: 'main' },
    update: {
      name: user.name,
      bio: user.bio || null,
      avatarUrl: user.avatar,
      githubUrl: `https://github.com/${user.login}`,
      email: user.email || undefined,
      location: user.location || undefined,
    },
    create: {
      id: 'main',
      name: user.name,
      title: 'Full Stack Developer',
      bio: user.bio || null,
      avatarUrl: user.avatar,
      githubUrl: `https://github.com/${user.login}`,
      email: user.email || undefined,
      location: user.location || undefined,
    },
  });

  return c.json({
    success: true,
    message: 'Profile synced from GitHub successfully',
    data: { siteConfig, readme: !!githubData.content },
  });
});

export default profile;
