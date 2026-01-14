import { getGitHubProfileReadme } from '@/lib/github-stats';
import { AboutClient } from './AboutClient';

export async function AboutSection() {
  const profileData = await getGitHubProfileReadme();

  return (
    <AboutClient
      readme={profileData?.content || ''}
      user={profileData?.user || null}
    />
  );
}
