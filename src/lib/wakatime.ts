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

// Get yearly stats (last 365 days)
export async function getWakaTimeYearlyStats(): Promise<WakaTimeStats | null> {
  if (!WAKATIME_API_KEY) {
    console.error('WAKATIME_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${WAKATIME_API_URL}/users/current/stats/last_year`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString('base64')}`,
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
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
      languages: (stats.languages || []).slice(0, 10).map((lang: { name: string; percent: number; total_seconds: number }) => ({
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
      projects: (stats.projects || []).slice(0, 10).map((project: { name: string; percent: number; total_seconds: number }) => ({
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
        text: stats.human_readable_range || 'Last year',
      },
    };
  } catch (error) {
    console.error('Error fetching WakaTime yearly stats:', error);
    return null;
  }
}

// Get stats for a specific calendar year
export async function getWakaTimeStatsForYear(year: number): Promise<WakaTimeStats | null> {
  if (!WAKATIME_API_KEY) {
    console.error('WAKATIME_API_KEY not configured');
    return null;
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  try {
    const response = await fetch(
      `${WAKATIME_API_URL}/users/current/summaries?start=${startDate}&end=${endDate}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString('base64')}`,
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      console.error('WakaTime API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    // Aggregate all summaries for the year
    let totalSeconds = 0;
    const languagesMap = new Map<string, number>();
    const editorsMap = new Map<string, number>();
    const osMap = new Map<string, number>();
    const projectsMap = new Map<string, number>();
    const categoriesMap = new Map<string, number>();
    let bestDay: { date: string; totalSeconds: number } | null = null;

    for (const day of data.data) {
      const daySeconds = day.grand_total?.total_seconds || 0;
      totalSeconds += daySeconds;

      // Track best day
      if (!bestDay || daySeconds > bestDay.totalSeconds) {
        bestDay = { date: day.range.date, totalSeconds: daySeconds };
      }

      // Aggregate languages
      for (const lang of day.languages || []) {
        const current = languagesMap.get(lang.name) || 0;
        languagesMap.set(lang.name, current + (lang.total_seconds || 0));
      }

      // Aggregate editors
      for (const editor of day.editors || []) {
        const current = editorsMap.get(editor.name) || 0;
        editorsMap.set(editor.name, current + (editor.total_seconds || 0));
      }

      // Aggregate OS
      for (const os of day.operating_systems || []) {
        const current = osMap.get(os.name) || 0;
        osMap.set(os.name, current + (os.total_seconds || 0));
      }

      // Aggregate projects
      for (const project of day.projects || []) {
        const current = projectsMap.get(project.name) || 0;
        projectsMap.set(project.name, current + (project.total_seconds || 0));
      }

      // Aggregate categories
      for (const cat of day.categories || []) {
        const current = categoriesMap.get(cat.name) || 0;
        categoriesMap.set(cat.name, current + (cat.total_seconds || 0));
      }
    }

    // Convert maps to sorted arrays
    const toSortedArray = (map: Map<string, number>) => {
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, seconds]) => ({
          name,
          totalSeconds: seconds,
          percent: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 1000) / 10 : 0,
          text: formatSeconds(seconds),
        }));
    };

    const daysInYear = data.data.length;
    const dailyAverage = daysInYear > 0 ? totalSeconds / daysInYear : 0;

    return {
      totalSeconds,
      totalHours: formatSeconds(totalSeconds),
      dailyAverage: formatSeconds(dailyAverage),
      bestDay: bestDay ? {
        date: bestDay.date,
        totalSeconds: bestDay.totalSeconds,
        text: formatSeconds(bestDay.totalSeconds),
      } : null,
      languages: toSortedArray(languagesMap).slice(0, 10).map(lang => ({
        ...lang,
        color: getLanguageColor(lang.name),
      })),
      editors: toSortedArray(editorsMap).slice(0, 5),
      operatingSystems: toSortedArray(osMap).slice(0, 5),
      projects: toSortedArray(projectsMap).slice(0, 10),
      categories: toSortedArray(categoriesMap).slice(0, 5),
      range: {
        start: startDate,
        end: endDate,
        text: `${year}`,
      },
    };
  } catch (error) {
    console.error(`Error fetching WakaTime stats for ${year}:`, error);
    return null;
  }
}

// Get available years (based on when user started using WakaTime)
export async function getWakaTimeAvailableYears(): Promise<number[]> {
  if (!WAKATIME_API_KEY) {
    return [];
  }

  const currentYear = new Date().getFullYear();
  const years: number[] = [];

  // Check up to 5 years back
  for (let year = currentYear; year >= currentYear - 4; year--) {
    try {
      const response = await fetch(
        `${WAKATIME_API_URL}/users/current/summaries?start=${year}-01-01&end=${year}-01-07`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString('base64')}`,
          },
          next: { revalidate: 86400 },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Check if there's any data for this year
        if (data.data && data.data.some((d: { grand_total?: { total_seconds?: number } }) => (d.grand_total?.total_seconds ?? 0) > 0)) {
          years.push(year);
        }
      }
    } catch {
      // Skip this year if there's an error
    }
  }

  return years;
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
