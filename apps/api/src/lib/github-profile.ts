// GitHub profile fetch for the admin profile sync. Ported from the web app's
// src/lib/github-stats.ts (getGitHubProfileReadme). Uses GITHUB_TOKEN to read
// the authenticated user and their profile README.

const GITHUB_API = 'https://api.github.com';

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  location: string | null;
  email: string | null;
  company: string | null;
  blog: string | null;
}

export interface GitHubProfile {
  content: string;
  user: {
    name: string;
    login: string;
    avatar: string;
    bio: string;
    location: string | null;
    email: string | null;
    company: string | null;
    blog: string | null;
  };
}

async function githubFetch<T>(endpoint: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const res = await fetch(`${GITHUB_API}${endpoint}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      console.error(`GitHub API error: ${res.status} for ${endpoint}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error(`GitHub fetch error for ${endpoint}:`, error);
    return null;
  }
}

export async function getGitHubProfileReadme(): Promise<GitHubProfile | null> {
  const token = process.env.GITHUB_TOKEN;
  const user = await githubFetch<GitHubUser>('/user');
  if (!user) return null;

  const mapped = (content: string): GitHubProfile => ({
    content,
    user: {
      name: user.name || user.login,
      login: user.login,
      avatar: user.avatar_url,
      bio: user.bio || '',
      location: user.location,
      email: user.email,
      company: user.company,
      blog: user.blog,
    },
  });

  // Profile README lives in a repo named the same as the username.
  try {
    const res = await fetch(`${GITHUB_API}/repos/${user.login}/${user.login}/readme`, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return mapped('');
    return mapped(await res.text());
  } catch (error) {
    console.error('Error fetching profile README:', error);
    return mapped('');
  }
}
