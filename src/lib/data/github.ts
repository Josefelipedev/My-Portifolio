// GitHub profile data layer. Like src/lib/data/content.ts, this switches source
// by env: when NEXT_PUBLIC_API_BASE_URL is set the homepage reads the live
// GitHub bundle (About README/user + Stats) from the standalone API — which
// runs on the VPS with a GITHUB_TOKEN and a non-rate-limited IP — instead of
// calling GitHub directly from the Cloudflare edge (where the shared egress IP
// hits GitHub's unauthenticated rate limit and the section comes back empty).
//
// When the API base URL is unset (local dev / monolith), it falls back to
// fetching GitHub directly via the local helpers.

import { cache } from 'react';
import { apiUrl } from '@/lib/api-fetch';
import { isApiConfigured } from '@/lib/api-client';
import {
  getGitHubProfileReadme,
  getGitHubStats,
  type GitHubStats,
} from '@/lib/github-stats';

type ProfileUser = NonNullable<
  Awaited<ReturnType<typeof getGitHubProfileReadme>>
>['user'];

export interface GitHubProfileBundle {
  user: ProfileUser | null;
  readme: string;
  stats: GitHubStats | null;
}

const EMPTY: GitHubProfileBundle = { user: null, readme: '', stats: null };

// cache() dedupes within a single render so the About and GitHub Stats sections
// share one fetch/computation per request.
export const getGitHubProfileData = cache(async (): Promise<GitHubProfileBundle> => {
  if (isApiConfigured()) {
    try {
      const res = await fetch(apiUrl('/api/profile/github'), {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return EMPTY;
      const json = (await res.json()) as { data?: GitHubProfileBundle };
      return json.data ?? EMPTY;
    } catch {
      return EMPTY;
    }
  }

  // Local fallback: fetch GitHub directly (works in dev with or without a token).
  const [profile, stats] = await Promise.all([
    getGitHubProfileReadme(),
    getGitHubStats(),
  ]);
  return {
    user: profile?.user ?? null,
    readme: profile?.content ?? '',
    stats,
  };
});
