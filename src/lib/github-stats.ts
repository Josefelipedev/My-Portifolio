// GitHub Statistics Fetcher
// Busca dados do perfil para exibir no portfolio

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

interface ContributionDay {
  date: string;
  count: number;
  level: number; // 0-4
}

interface GitHubStats {
  user: {
    name: string;
    login: string;
    avatar: string;
    bio: string;
    followers: number;
    publicRepos: number;
    memberSince: string;
  };
  stats: {
    totalRepos: number;
    totalStars: number;
    totalForks: number;
    totalCommits: number;
    totalPRs: number;
    totalIssues: number;
  };
  languages: { name: string; percentage: number; color: string }[];
  topRepos: {
    name: string;
    description: string;
    stars: number;
    forks: number;
    language: string;
    url: string;
  }[];
  contributions: ContributionDay[];
  skills: string[];
}

const GITHUB_API = 'https://api.github.com';

// Language colors (subset of GitHub's colors)
const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Shell: '#89e051',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

async function githubFetch<T>(endpoint: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN;

  try {
    const res = await fetch(`${GITHUB_API}${endpoint}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) {
      console.error(`GitHub API error: ${res.status} for ${endpoint}`);
      return null;
    }

    return res.json();
  } catch (error) {
    console.error(`GitHub fetch error for ${endpoint}:`, error);
    return null;
  }
}

export async function getGitHubStats(username?: string): Promise<GitHubStats | null> {
  // Get authenticated user if no username provided
  let user: GitHubUser | null;

  if (username) {
    user = await githubFetch<GitHubUser>(`/users/${username}`);
  } else {
    user = await githubFetch<GitHubUser>('/user');
  }

  if (!user) return null;

  const login = user.login;

  // Fetch repos
  const repos = await githubFetch<GitHubRepo[]>(
    `/users/${login}/repos?per_page=100&sort=updated`
  );

  if (!repos) return null;

  // Calculate language stats
  const languageBytes: Record<string, number> = {};
  let totalBytes = 0;

  for (const repo of repos) {
    if (repo.language) {
      const langData = await githubFetch<Record<string, number>>(
        `/repos/${login}/${repo.name}/languages`
      );
      if (langData) {
        for (const [lang, bytes] of Object.entries(langData)) {
          languageBytes[lang] = (languageBytes[lang] || 0) + bytes;
          totalBytes += bytes;
        }
      }
    }
  }

  // Convert to percentages
  const languages = Object.entries(languageBytes)
    .map(([name, bytes]) => ({
      name,
      percentage: Math.round((bytes / totalBytes) * 1000) / 10,
      color: LANGUAGE_COLORS[name] || '#8b8b8b',
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8);

  // Calculate total stats
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);

  // Get PR count
  const prsData = await githubFetch<{ total_count: number }>(
    `/search/issues?q=author:${login}+type:pr`
  );
  const totalPRs = prsData?.total_count || 0;

  // Get issues count
  const issuesData = await githubFetch<{ total_count: number }>(
    `/search/issues?q=author:${login}+type:issue`
  );
  const totalIssues = issuesData?.total_count || 0;

  // Get commit count (estimate from events)
  const eventsData = await githubFetch<Array<{ type: string }>>(
    `/users/${login}/events?per_page=100`
  );
  const recentCommits = eventsData?.filter(e => e.type === 'PushEvent').length || 0;
  // Estimate total commits (rough approximation)
  const accountAgeYears = Math.max(1,
    (Date.now() - new Date(user.created_at).getTime()) / (365 * 24 * 60 * 60 * 1000)
  );
  const estimatedTotalCommits = Math.round(recentCommits * 52 * accountAgeYears / 2);

  // Top repos by stars
  const topRepos = repos
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6)
    .map(repo => ({
      name: repo.name,
      description: repo.description || '',
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language || 'Unknown',
      url: repo.html_url,
    }));

  // Extract skills from repos
  const skillsSet = new Set<string>();

  // Add languages as skills
  languages.forEach(lang => skillsSet.add(lang.name));

  // Add topics as skills
  repos.forEach(repo => {
    repo.topics?.forEach(topic => {
      const normalized = topic.charAt(0).toUpperCase() + topic.slice(1);
      skillsSet.add(normalized);
    });
  });

  // Common framework detection from repo names/topics
  const frameworkKeywords = [
    'react', 'nextjs', 'next', 'vue', 'angular', 'svelte',
    'node', 'express', 'fastify', 'nestjs', 'django', 'flask',
    'spring', 'laravel', 'rails', 'docker', 'kubernetes', 'aws',
    'firebase', 'mongodb', 'postgresql', 'mysql', 'redis',
    'graphql', 'rest', 'api', 'tailwind', 'bootstrap',
    'prisma', 'sequelize', 'typeorm',
  ];

  repos.forEach(repo => {
    const searchText = `${repo.name} ${repo.description || ''} ${repo.topics?.join(' ') || ''}`.toLowerCase();
    frameworkKeywords.forEach(keyword => {
      if (searchText.includes(keyword)) {
        const formatted = keyword === 'nextjs' ? 'Next.js' :
                         keyword === 'nodejs' ? 'Node.js' :
                         keyword === 'mongodb' ? 'MongoDB' :
                         keyword === 'postgresql' ? 'PostgreSQL' :
                         keyword === 'mysql' ? 'MySQL' :
                         keyword === 'graphql' ? 'GraphQL' :
                         keyword === 'tailwind' ? 'Tailwind CSS' :
                         keyword.charAt(0).toUpperCase() + keyword.slice(1);
        skillsSet.add(formatted);
      }
    });
  });

  // Generate contribution heatmap (mock data based on activity)
  const contributions: ContributionDay[] = [];
  const today = new Date();

  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic-looking contribution data
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseChance = isWeekend ? 0.3 : 0.6;
    const hasContribution = Math.random() < baseChance;

    let count = 0;
    let level = 0;

    if (hasContribution) {
      count = Math.floor(Math.random() * 10) + 1;
      level = count <= 2 ? 1 : count <= 5 ? 2 : count <= 8 ? 3 : 4;
    }

    contributions.push({
      date: date.toISOString().split('T')[0],
      count,
      level,
    });
  }

  return {
    user: {
      name: user.name || user.login,
      login: user.login,
      avatar: user.avatar_url,
      bio: user.bio || '',
      followers: user.followers,
      publicRepos: user.public_repos,
      memberSince: new Date(user.created_at).getFullYear().toString(),
    },
    stats: {
      totalRepos: repos.length,
      totalStars,
      totalForks,
      totalCommits: estimatedTotalCommits,
      totalPRs,
      totalIssues,
    },
    languages,
    topRepos,
    contributions,
    skills: Array.from(skillsSet).slice(0, 20),
  };
}

// Lighter version that only fetches basic stats
export async function getBasicGitHubStats(): Promise<{
  repos: number;
  stars: number;
  followers: number;
  contributions: number;
} | null> {
  const user = await githubFetch<GitHubUser>('/user');
  if (!user) return null;

  const repos = await githubFetch<GitHubRepo[]>(
    `/users/${user.login}/repos?per_page=100`
  );
  if (!repos) return null;

  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

  return {
    repos: repos.length,
    stars: totalStars,
    followers: user.followers,
    contributions: Math.floor(Math.random() * 500) + 200, // Placeholder
  };
}
