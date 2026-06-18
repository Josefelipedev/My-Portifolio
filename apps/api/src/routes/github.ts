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

const github = new Hono();

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

export default github;
