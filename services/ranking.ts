import { ArticleCategory } from '@/types';
import { MAJOR_KEYWORDS, MINOR_KEYWORDS, CATEGORY_KEYWORDS } from '@/constants/Keywords';

export function calculateImportanceScore(title: string, summary: string, source: string): number {
  const text = (title + ' ' + summary).toLowerCase();
  const sourceLower = source.toLowerCase();
  let score = 1;

  // Source authority scoring (Max +3)
  const tier1Sources = [
    'github', 'aws', 'google developers', 'microsoft devblogs',
    'openai', 'anthropic', 'hugging face', 'linux kernel',
    'rust lang', 'kubernetes', 'cncf',
  ];
  const tier2Sources = [
    'techcrunch', 'the verge', 'ars technica', 'venturebeat',
    'infoq', 'the register', 'hacker news',
  ];

  if (tier1Sources.some(s => sourceLower.includes(s))) {
    score += 3;
  } else if (tier2Sources.some(s => sourceLower.includes(s))) {
    score += 2;
  } else if (sourceLower.includes('blog') || sourceLower.includes('engineering')) {
    score += 1;
  }

  // Major keywords (each adds +1, max +3)
  let keywordMatches = 0;
  for (const keyword of MAJOR_KEYWORDS) {
    if (text.includes(keyword)) {
      keywordMatches++;
      if (keywordMatches >= 3) break;
    }
  }
  score += Math.min(keywordMatches, 3);

  // Minor keywords penalty
  let penalty = 0;
  for (const keyword of MINOR_KEYWORDS) {
    if (text.includes(keyword)) {
      penalty += 0.5;
      if (penalty >= 2) break;
    }
  }
  score -= penalty;

  // Clamp between 1 and 5
  return Math.max(1, Math.min(5, Math.round(score)));
}

export function categorizeArticle(title: string, summary: string, source: string): ArticleCategory {
  const text = (title + ' ' + summary + ' ' + source).toLowerCase();

  // Check each category by keyword relevance
  const scores: { category: ArticleCategory; score: number }[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        matchCount++;
      }
    }
    scores.push({ category: category as ArticleCategory, score: matchCount });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Return top category if score > 0, else General
  return scores[0].score > 0 ? scores[0].category : 'General';
}

export function deduplicateByLink<T extends { link: string }>(articles: T[]): T[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    if (seen.has(article.link)) return false;
    seen.add(article.link);
    return true;
  });
}

export function deduplicateByTitle<T extends { title: string }>(articles: T[]): T[] {
  const seen = new Set<string>();
  const normalized = new Map<string, T>();

  for (const article of articles) {
    // Normalize title: lowercase, remove punctuation, collapse whitespace
    const normTitle = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!seen.has(normTitle)) {
      seen.add(normTitle);
      normalized.set(normTitle, article);
    }
  }

  return Array.from(normalized.values());
}
