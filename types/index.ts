export interface Article {
  id: string;
  title: string;
  link: string;
  source_name: string;
  source_icon_uri?: string;
  pub_date: number;
  fetched_at: number;
  summary: string;
  image_uri?: string;
  importance_score: number; // 1-5
  is_bookmarked: boolean;
  is_read: boolean;
  nsfw_status: number; // 0=unclassified, 1=clean, 2=nsfw
}

export interface ArticleInput {
  id: string;
  title: string;
  link: string;
  source_name: string;
  source_icon_uri?: string;
  pub_date: number;
  fetched_at: number;
  summary: string;
  image_uri?: string;
  importance_score: number;
}

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  icon?: string;
  enabled: boolean;
  keywords?: string[];
  maxArticles?: number;
}

export interface CustomFeed {
  id: string;
  name: string;
  url: string;
  rss_url: string;
  icon?: string;
  added_at: number;
}

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  compactDensity: boolean;
  minImportance: number; // 1-5
  autoMarkRead: boolean;
  notifyBreaking: boolean;
  notifyDaily: boolean;
  notifyWeekly: boolean;
  blockedKeywords: string[];
  enabledSources: string[];
}

export interface FilterState {
  sourceNames: string[];
  minRating: number;
  datePreset: '24h' | '7d' | '30d' | null;
  sortOrder: 'newest' | 'oldest';
}

export const DEFAULT_FILTER: FilterState = {
  sourceNames: [],
  minRating: 0,
  datePreset: null,
  sortOrder: 'newest',
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  fontSize: 'medium',
  compactDensity: false,
  minImportance: 1,
  autoMarkRead: true,
  notifyBreaking: true,
  notifyDaily: false,
  notifyWeekly: false,
  blockedKeywords: [],
  enabledSources: [],
};
