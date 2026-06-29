// Public GitHub routes — serve the local GitHubRepoCache table so the public
// homepage never has to hit GitHub directly. The web app only ever *writes*
// this cache (via the auth-gated github/import + github/repos upserts); there
// was no pre-existing public HTTP handler that reads it, so this is the
// cache-read counterpart. Ordering mirrors how repos/projects are surfaced
// elsewhere (most-starred first). Responses match the @portfolio/shared
// contracts.
//
// Phase 2 (deferred: external API / auth):
//   GET  /api/github/repos          — auth + LIVE GitHub fetchUserRepos (web)
//   GET  /api/github/orgs           — auth + LIVE GitHub fetchUserOrgs
//   GET  /api/github/orgs/:org/repos — auth + LIVE GitHub fetchOrgRepos
//   POST /api/github/import         — auth + LIVE GitHub + AI summary
// Only the cache-read path is ported below.

import { Hono } from 'hono';
import prisma from '../db';
import { requireAuth, type AuthEnv } from '../lib/auth';
import { requireCsrf } from '../lib/csrf';
import {
  fetchUserRepos,
  fetchUserOrgs,
  fetchOrgRepos,
  fetchRepoByFullName,
  fetchRepoReadme,
  fetchRepoLanguages,
} from '../lib/github';
import { generateProjectSummary } from '../lib/claude';

const github = new Hono<AuthEnv>();

// Mirrors withCacheHeaders(res, 60, 300) from the web api-utils.
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

// Public read of the cached repos. Most-starred first, then most recently
// updated — the natural ordering for surfacing pinned/featured work.
github.get('/github/repos', async (c) => {
  const repos = await prisma.gitHubRepoCache.findMany({
    orderBy: [{ stargazers: 'desc' }, { updatedAt: 'desc' }],
  });
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(repos);
});

// ---- LIVE GitHub (authenticated) ----

// GET /github/user/repos — LIVE fetch of the authenticated user's repos, marked
// with import status + cached. Mirrors the org repos handler below; used by the
// admin "GitHub Import" page (the public /github/repos route above only reads
// the cache and returns a bare array).
github.get('/github/user/repos', requireAuth, async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const perPage = parseInt(c.req.query('per_page') || '30', 10);

  const repos = await fetchUserRepos(page, perPage);

  const imported = await prisma.project.findMany({
    where: { githubId: { not: null } },
    select: { githubId: true },
  });
  const importedIds = new Set(imported.map((p) => p.githubId));

  for (const repo of repos) {
    const cache = {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      homepage: repo.homepage,
      language: repo.language,
      topics: (repo.topics || []).join(','),
      stargazers: repo.stargazers_count,
      forksCount: repo.forks_count,
      updatedAt: new Date(repo.updated_at),
    };
    await prisma.gitHubRepoCache.upsert({
      where: { id: repo.id },
      create: { id: repo.id, ...cache },
      update: { ...cache, cachedAt: new Date() },
    });
  }

  return c.json({
    repos: repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      homepage: repo.homepage,
      language: repo.language,
      topics: repo.topics || [],
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      isImported: importedIds.has(repo.id),
    })),
  });
});

// GET /github/orgs — the authenticated user's organizations.
github.get('/github/orgs', requireAuth, async (c) => {
  const orgs = await fetchUserOrgs();
  return c.json({
    orgs: orgs.map((o) => ({
      id: o.id,
      login: o.login,
      description: o.description,
      avatar_url: o.avatar_url,
      html_url: o.html_url,
    })),
  });
});

// GET /github/orgs/:org/repos — an org's repos, marked with import status + cached.
github.get('/github/orgs/:org/repos', requireAuth, async (c) => {
  const org = c.req.param('org');
  const page = parseInt(c.req.query('page') || '1', 10);
  const perPage = parseInt(c.req.query('per_page') || '30', 10);

  const repos = await fetchOrgRepos(org, page, perPage);

  const imported = await prisma.project.findMany({
    where: { githubId: { not: null } },
    select: { githubId: true },
  });
  const importedIds = new Set(imported.map((p) => p.githubId));

  for (const repo of repos) {
    const cache = {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      homepage: repo.homepage,
      language: repo.language,
      topics: (repo.topics || []).join(','),
      stargazers: repo.stargazers_count,
      forksCount: repo.forks_count,
      updatedAt: new Date(repo.updated_at),
    };
    await prisma.gitHubRepoCache.upsert({
      where: { id: repo.id },
      create: { id: repo.id, ...cache },
      update: { ...cache, cachedAt: new Date() },
    });
  }

  return c.json({
    org,
    repos: repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      homepage: repo.homepage,
      language: repo.language,
      topics: repo.topics || [],
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      isImported: importedIds.has(repo.id),
    })),
  });
});

// POST /github/import — import a repo as a Project (optional AI summary).
github.post('/github/import', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    repoFullName?: string;
    generateSummary?: boolean;
  };
  if (!body.repoFullName) {
    return c.json({ error: 'repoFullName is required', code: 'BAD_REQUEST' }, 400);
  }

  const repo = await fetchRepoByFullName(body.repoFullName);

  const existing = await prisma.project.findUnique({ where: { githubId: repo.id } });
  if (existing) {
    return c.json({ error: 'Repository already imported', project: existing }, 409);
  }

  let aiSummary: string | null = null;
  let aiSummarizedAt: Date | null = null;
  if (body.generateSummary) {
    const [owner, repoName] = body.repoFullName.split('/');
    const readme = await fetchRepoReadme(owner, repoName);
    const languages = await fetchRepoLanguages(owner, repoName);
    aiSummary = await generateProjectSummary({
      repoName: repo.name,
      description: repo.description,
      readme,
      languages: Object.keys(languages),
      topics: repo.topics,
    });
    aiSummarizedAt = new Date();
  }

  const project = await prisma.project.create({
    data: {
      title: repo.name,
      description: repo.description || 'No description provided',
      technologies: repo.topics.length > 0 ? repo.topics.join(',') : repo.language || '',
      repoUrl: repo.html_url,
      demoUrl: repo.homepage || null,
      githubId: repo.id,
      source: 'github',
      stars: repo.stargazers_count,
      aiSummary,
      aiSummarizedAt,
    },
  });

  return c.json({ success: true, project });
});

export default github;
