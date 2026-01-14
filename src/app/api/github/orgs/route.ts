import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { fetchUserOrgs } from '@/lib/github';

export async function GET() {
  try {
    // Check authentication
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch organizations from GitHub
    const orgs = await fetchUserOrgs();

    const orgsWithInfo = orgs.map((org) => ({
      id: org.id,
      login: org.login,
      description: org.description,
      avatar_url: org.avatar_url,
      html_url: org.html_url,
    }));

    return NextResponse.json({ orgs: orgsWithInfo });
  } catch (error) {
    console.error('Error fetching GitHub organizations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
