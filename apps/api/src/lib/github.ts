// GitHub API client. Ported from the web app's src/lib/github.ts (types inlined,
// Next-specific fetch `next.revalidate` option dropped). Uses GITHUB_TOKEN.

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  owner: { login: string; avatar_url: string };
}

export interface GitHubOrg {
  id: number;
  login: string;
  description: string | null;
  avatar_url: string;
  html_url: string;
  repos_url: string;
}

const GITHUB_API_BASE = 'https://api.github.com';

function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN environment variable is not set');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Portfolio-App',
  };
}

export async function fetchUserRepos(
  page = 1,
  perPage = 30,
  sort: 'updated' | 'created' | 'pushed' | 'full_name' = 'updated'
): Promise<GitHubRepo[]> {
  const url = `${GITHUB_API_BASE}/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&type=owner`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  return response.json() as Promise<GitHubRepo[]>;
}

export async function fetchRepoByFullName(fullName: string): Promise<GitHubRepo> {
  const url = `${GITHUB_API_BASE}/repos/${fullName}`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  return response.json() as Promise<GitHubRepo>;
}

export async function fetchRepoReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`;
    const response = await fetch(url, {
      headers: { ...getHeaders(), Accept: 'application/vnd.github.raw+json' },
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

export async function fetchRepoLanguages(owner: string, repo: string): Promise<Record<string, number>> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/languages`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) return {};
  return response.json() as Promise<Record<string, number>>;
}

export async function fetchAuthenticatedUser(): Promise<{ login: string; avatar_url: string; name: string | null }> {
  const url = `${GITHUB_API_BASE}/user`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  return response.json() as Promise<{ login: string; avatar_url: string; name: string | null }>;
}

export function extractOwnerAndRepo(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export async function fetchUserOrgs(): Promise<GitHubOrg[]> {
  const url = `${GITHUB_API_BASE}/user/orgs`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  return response.json() as Promise<GitHubOrg[]>;
}

export async function fetchOrgRepos(
  org: string,
  page = 1,
  perPage = 30,
  sort: 'updated' | 'created' | 'pushed' | 'full_name' = 'updated'
): Promise<GitHubRepo[]> {
  const url = `${GITHUB_API_BASE}/orgs/${org}/repos?page=${page}&per_page=${perPage}&sort=${sort}&type=all`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  return response.json() as Promise<GitHubRepo[]>;
}
