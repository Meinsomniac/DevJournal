import { PROHIBITED_CATEGORIES, ProhibitedCategory } from '@/constants/prohibitedContent';
import { fetchAndParseFeed } from './rssParser';

export interface CategoryMatch {
  category: ProhibitedCategory;
  matchedArticles: { title: string; matchedTerms: string[] }[];
}

export interface ModerationResult {
  allowed: boolean;
  flaggedCategories: CategoryMatch[];
  totalArticlesChecked: number;
}

export async function moderateFeed(url: string, sourceName: string): Promise<ModerationResult> {
  const articles = await fetchAndParseFeed(url, sourceName, undefined, true);

  const flaggedCategories: CategoryMatch[] = [];

  for (const category of PROHIBITED_CATEGORIES) {
    const matches = findCategoryMatches(articles, category);
    if (matches.length > 0) {
      flaggedCategories.push({ category, matchedArticles: matches });
    }
  }

  return {
    allowed: flaggedCategories.length === 0,
    flaggedCategories,
    totalArticlesChecked: articles.length,
  };
}

function findCategoryMatches(
  articles: { title: string; summary?: string }[],
  category: ProhibitedCategory
): { title: string; matchedTerms: string[] }[] {
  const results: { title: string; matchedTerms: string[] }[] = [];

  for (const article of articles) {
    const text = `${article.title} ${article.summary ?? ''}`.toLowerCase();
    const matchedTerms = category.keywords.filter((kw) => text.includes(kw.toLowerCase()));
    if (matchedTerms.length > 0) {
      results.push({ title: article.title, matchedTerms });
    }
  }

  return results;
}
