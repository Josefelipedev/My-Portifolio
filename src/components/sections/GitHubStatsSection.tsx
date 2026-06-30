import { getGitHubProfileData } from '@/lib/data/github';
import { GitHubStatsClient } from './GitHubStatsClient';

export async function GitHubStatsSection() {
  const { stats } = await getGitHubProfileData();

  if (!stats) {
    return null; // Don't render if no GitHub data
  }

  return <GitHubStatsClient stats={stats} />;
}
