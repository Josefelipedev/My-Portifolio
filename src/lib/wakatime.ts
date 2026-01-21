const WAKATIME_API_KEY = process.env.WAKATIME_API_KEY;
const WAKATIME_API_URL = 'https://wakatime.com/api/v1';

export interface WakaTimeStats {
  totalSeconds: number;
  totalHours: string;
  dailyAverage: string;
  bestDay: {
    date: string;
    totalSeconds: number;
    text: string;
  } | null;
  languages: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
    color: string;
  }[];
  editors: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  operatingSystems: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  projects: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  categories: {
    name: string;
    percent: number;
    totalSeconds: number;
    text: string;
  }[];
  range: {
    start: string;
    end: string;
    text: string;
  };
}

// Language colors mapping
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3776ab',
  Java: '#b07219',
  'C#': '#239120',
  'C++': '#f34b7d',
  C: '#555555',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#cc342d',
  PHP: '#777bb4',
  Swift: '#fa7343',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Vue: '#4FC08D',
  React: '#61DAFB',
  JSON: '#292929',
  YAML: '#cb171e',
  Markdown: '#083fa1',
  Bash: '#4EAA25',
  Shell: '#89e051',
  SQL: '#e38c00',
  GraphQL: '#e535ab',
  Docker: '#2496ED',
  Terraform: '#7B42BC',
  Other: '#8b8b8b',
};

function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language] || LANGUAGE_COLORS.Other;
}

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export async function getWakaTimeStats(): Promise<WakaTimeStats | null> {
  if (!WAKATIME_API_KEY) {
    console.error('WAKATIME_API_KEY not configured');
    return null;
  }

  try {
    // Fetch stats for last 7 days
    const response = await fetch(
      `${WAKATIME_API_URL}/users/current/stats/last_7_days`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString('base64')}`,
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!response.ok) {
      console.error('WakaTime API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const stats = data.data;

    if (!stats) {
      return null;
    }

    return {
      totalSeconds: stats.total_seconds || 0,
      totalHours: formatSeconds(stats.total_seconds || 0),
      dailyAverage: formatSeconds(stats.daily_average || 0),
      bestDay: stats.best_day ? {
        date: stats.best_day.date,
        totalSeconds: stats.best_day.total_seconds,
        text: formatSeconds(stats.best_day.total_seconds),
      } : null,
      languages: (stats.languages || []).slice(0, 8).map((lang: { name: string; percent: number; total_seconds: number }) => ({
        name: lang.name,
        percent: Math.round(lang.percent * 10) / 10,
        totalSeconds: lang.total_seconds,
        text: formatSeconds(lang.total_seconds),
        color: getLanguageColor(lang.name),
      })),
      editors: (stats.editors || []).slice(0, 5).map((editor: { name: string; percent: number; total_seconds: number }) => ({
        name: editor.name,
        percent: Math.round(editor.percent * 10) / 10,
        totalSeconds: editor.total_seconds,
        text: formatSeconds(editor.total_seconds),
      })),
      operatingSystems: (stats.operating_systems || []).slice(0, 5).map((os: { name: string; percent: number; total_seconds: number }) => ({
        name: os.name,
        percent: Math.round(os.percent * 10) / 10,
        totalSeconds: os.total_seconds,
        text: formatSeconds(os.total_seconds),
      })),
      projects: (stats.projects || []).slice(0, 5).map((project: { name: string; percent: number; total_seconds: number }) => ({
        name: project.name,
        percent: Math.round(project.percent * 10) / 10,
        totalSeconds: project.total_seconds,
        text: formatSeconds(project.total_seconds),
      })),
      categories: (stats.categories || []).slice(0, 5).map((cat: { name: string; percent: number; total_seconds: number }) => ({
        name: cat.name,
        percent: Math.round(cat.percent * 10) / 10,
        totalSeconds: cat.total_seconds,
        text: formatSeconds(cat.total_seconds),
      })),
      range: {
        start: stats.start || '',
        end: stats.end || '',
        text: stats.human_readable_range || 'Last 7 days',
      },
    };
  } catch (error) {
    console.error('Error fetching WakaTime stats:', error);
    return null;
  }
}

// Get all-time stats
export async function getWakaTimeAllTimeStats(): Promise<{ totalSeconds: number; text: string } | null> {
  if (!WAKATIME_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `${WAKATIME_API_URL}/users/current/all_time_since_today`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString('base64')}`,
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      totalSeconds: data.data?.total_seconds || 0,
      text: data.data?.text || '0 hrs',
    };
  } catch (error) {
    console.error('Error fetching WakaTime all-time stats:', error);
    return null;
  }
}
