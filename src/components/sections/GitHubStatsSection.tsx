import { getGitHubStats } from '@/lib/github-stats';
import { GitHubStatsClient } from './GitHubStatsClient';

export async function GitHubStatsSection() {
  const stats = await getGitHubStats();

  if (!stats) {
    return null; // Don't render if no GitHub data
  }

  return <GitHubStatsClient stats={stats} />;
}
