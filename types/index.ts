export type ArticleCategory =
  | 'AI'
  | 'Frontend'
  | 'Backend'
  | 'Infrastructure'
  | 'Security'
  | 'Career'
  | 'Tools'
  | 'General';

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
  category: ArticleCategory;
  is_bookmarked: boolean;
  is_read: boolean;
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
  category: ArticleCategory;
}

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: ArticleCategory;
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
  category: ArticleCategory;
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
