import prisma from '@/lib/prisma';

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

// Get stats for a specific calendar year using the stats endpoint
// First checks cache, then fetches from API if needed
export async function getWakaTimeStatsForYear(year: number, useCache = true): Promise<WakaTimeStats | null> {
  // Try to get from cache first (for past years)
  const currentYear = new Date().getFullYear();
  const isPastYear = year < currentYear;

  if (useCache && isPastYear) {
    const cached = await getYearStatsFromCache(year);
    if (cached) {
      console.log(`WakaTime: Using cached data for ${year}`);
      return cached;
    }
  }

  if (!WAKATIME_API_KEY) {
    console.error('WAKATIME_API_KEY not configured');
    return null;
  }

  try {
    // Use the stats endpoint with year range - this is what WakaTime uses for "Year in Review"
    const response = await fetch(
      `${WAKATIME_API_URL}/users/current/stats/${year}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString('base64')}`,
        },
        next: { revalidate: isPastYear ? 604800 : 86400 }, // 7 days for past years, 1 day for current
      }
    );

    if (!response.ok) {
      console.error('WakaTime API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const stats = data.data;

    if (!stats || stats.total_seconds === 0) {
      return null;
    }

    const result: WakaTimeStats = {
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
        start: stats.start || `${year}-01-01`,
        end: stats.end || `${year}-12-31`,
        text: stats.human_readable_range || `${year}`,
      },
    };

    // Cache past years data in the database
    if (useCache && isPastYear) {
      await saveYearStatsToCache(year, result);
    }

    return result;
  } catch (error) {
    console.error(`Error fetching WakaTime stats for ${year}:`, error);
    return null;
  }
}

// Save year stats to database cache
async function saveYearStatsToCache(year: number, stats: WakaTimeStats): Promise<void> {
  try {
    await prisma.wakaTimeYearCache.upsert({
      where: { year },
      update: {
        totalSeconds: stats.totalSeconds,
        totalHours: stats.totalHours,
        dailyAverage: stats.dailyAverage,
        bestDayDate: stats.bestDay?.date || null,
        bestDaySeconds: stats.bestDay?.totalSeconds || null,
        bestDayText: stats.bestDay?.text || null,
        languages: JSON.stringify(stats.languages),
        editors: JSON.stringify(stats.editors),
        operatingSystems: JSON.stringify(stats.operatingSystems),
        projects: JSON.stringify(stats.projects),
        categories: JSON.stringify(stats.categories),
        rangeStart: stats.range.start,
        rangeEnd: stats.range.end,
        rangeText: stats.range.text,
        cachedAt: new Date(),
      },
      create: {
        id: `year_${year}`,
        year,
        totalSeconds: stats.totalSeconds,
        totalHours: stats.totalHours,
        dailyAverage: stats.dailyAverage,
        bestDayDate: stats.bestDay?.date || null,
        bestDaySeconds: stats.bestDay?.totalSeconds || null,
        bestDayText: stats.bestDay?.text || null,
        languages: JSON.stringify(stats.languages),
        editors: JSON.stringify(stats.editors),
        operatingSystems: JSON.stringify(stats.operatingSystems),
        projects: JSON.stringify(stats.projects),
        categories: JSON.stringify(stats.categories),
        rangeStart: stats.range.start,
        rangeEnd: stats.range.end,
        rangeText: stats.range.text,
      },
    });
    console.log(`WakaTime: Cached data for ${year}`);
  } catch (error) {
    console.error(`Error caching WakaTime stats for ${year}:`, error);
  }
}

// Get year stats from database cache
async function getYearStatsFromCache(year: number): Promise<WakaTimeStats | null> {
  try {
    const cached = await prisma.wakaTimeYearCache.findUnique({
      where: { year },
    });

    if (!cached) {
      return null;
    }

    return {
      totalSeconds: cached.totalSeconds,
      totalHours: cached.totalHours,
      dailyAverage: cached.dailyAverage,
      bestDay: cached.bestDayDate ? {
        date: cached.bestDayDate,
        totalSeconds: cached.bestDaySeconds || 0,
        text: cached.bestDayText || '',
      } : null,
      languages: JSON.parse(cached.languages),
      editors: JSON.parse(cached.editors),
      operatingSystems: JSON.parse(cached.operatingSystems),
      projects: JSON.parse(cached.projects),
      categories: JSON.parse(cached.categories),
      range: {
        start: cached.rangeStart,
        end: cached.rangeEnd,
        text: cached.rangeText,
      },
    };
  } catch (error) {
    console.error(`Error getting cached WakaTime stats for ${year}:`, error);
    return null;
  }
}

// Clear cache for a specific year (useful for refreshing data)
export async function clearWakaTimeYearCache(year: number): Promise<boolean> {
  try {
    await prisma.wakaTimeYearCache.delete({
      where: { year },
    });
    return true;
  } catch {
    return false;
  }
}

// Get all cached years
export async function getCachedWakaTimeYears(): Promise<number[]> {
  try {
    const cached = await prisma.wakaTimeYearCache.findMany({
      select: { year: true },
      orderBy: { year: 'desc' },
    });
    return cached.map(c => c.year);
  } catch {
    return [];
  }
}

// Get available years (based on when user started using WakaTime)
export async function getWakaTimeAvailableYears(): Promise<number[]> {
  if (!WAKATIME_API_KEY) {
    return [];
  }

  const currentYear = new Date().getFullYear();
  const years: number[] = [];

  // Check up to 5 years back using the stats endpoint
  for (let year = currentYear; year >= currentYear - 4; year--) {
    try {
      const response = await fetch(
        `${WAKATIME_API_URL}/users/current/stats/${year}`,
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
        if (data.data && data.data.total_seconds > 0) {
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
