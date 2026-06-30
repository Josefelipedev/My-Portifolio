import { getGitHubProfileData } from '@/lib/data/github';
import { AboutClient } from './AboutClient';

export async function AboutSection() {
  const { readme, user } = await getGitHubProfileData();

  return <AboutClient readme={readme || ''} user={user || null} />;
}
