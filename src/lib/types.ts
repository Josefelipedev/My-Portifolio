// Shared types for the portfolio application

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
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface ProjectWithSummary {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  repoUrl: string;
  demoUrl: string | null;
  githubId: number | null;
  source: 'manual' | 'github';
  aiSummary: string | null;
  aiSummarizedAt: Date | null;
  imageUrl: string | null;
  stars: number | null;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperienceWithDates {
  id: string;
  title: string;
  description: string;
  responsibilities: string[];
  challenges: string[];
  technologies: string[];
  company: string | null;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillCategory {
  name: string;
  skills: {
    id: string;
    name: string;
    level: number;
    iconUrl: string | null;
  }[];
}

export interface SiteConfigType {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  email: string | null;
  location: string | null;
}

export interface ContactFormData {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// GitHub Organization type
export interface GitHubOrg {
  id: number;
  login: string;
  description: string | null;
  avatar_url: string;
  html_url: string;
  repos_url: string;
}

// Skill suggestion from AI
export interface SkillSuggestion {
  name: string;
  category: 'frontend' | 'backend' | 'devops' | 'tools' | 'other';
  level: number; // 1-5
  reason: string; // AI justification
}

// Skill suggestion response
export interface SkillSuggestionResponse {
  suggestions: SkillSuggestion[];
  provider: string;
}
