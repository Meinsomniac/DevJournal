import { ArticleCategory } from '@/types';

export interface DiscoveredFeed {
  name: string;
  rssUrl: string;
  url: string;
  favicon: string;
  category: ArticleCategory;
}

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

// ─── Discover RSS feeds from a website URL ──────────────────────────────────

export async function discoverRssFromUrl(url: string): Promise<DiscoveredFeed[]> {
  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // If the response is already an RSS/Atom feed, return it directly
    const isFeed = text.includes('<rss') || text.includes('<feed') || text.includes('<channel') || contentType.includes('rss') || contentType.includes('atom') || contentType.includes('xml');

    if (isFeed) {
      const name = extractNameFromUrl(normalizedUrl);
      const favicon = extractFavicon(normalizedUrl);
      const category = guessCategory(name + ' ' + normalizedUrl);
      return [{ name, rssUrl: normalizedUrl, url: normalizedUrl, favicon, category }];
    }

    // Parse HTML for <link> tags pointing to feeds
    const feeds: DiscoveredFeed[] = [];
    const linkRegex = /<link[^>]+>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
      const tag = match[0];

      const relMatch = tag.match(/rel=["']([^"']+)["']/i);
      const typeMatch = tag.match(/type=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      const titleMatch = tag.match(/title=["']([^"']+)["']/i);

      if (!relMatch || !typeMatch || !hrefMatch) continue;

      const rel = relMatch[1].toLowerCase();
      const type = typeMatch[1].toLowerCase();

      if (rel !== 'alternate') continue;
      if (type !== 'application/rss+xml' && type !== 'application/atom+xml') continue;

      let rssUrl = hrefMatch[1];
      if (rssUrl.startsWith('//')) rssUrl = 'https:' + rssUrl;
      if (rssUrl.startsWith('/')) {
        try {
          const base = new URL(normalizedUrl);
          rssUrl = base.origin + rssUrl;
        } catch {
          continue;
        }
      }

      const name = titleMatch?.[1] || extractNameFromUrl(normalizedUrl);
      const favicon = extractFavicon(normalizedUrl);
      const category = guessCategory(name + ' ' + rssUrl);

      feeds.push({ name, rssUrl, url: normalizedUrl, favicon, category });
    }

    // Fallback: pattern speculation for JS-rendered sites (Substack, Hashnode, Ghost, WordPress)
    if (feeds.length === 0) {
      const speculated = await speculateFeedUrls(normalizedUrl);
      feeds.push(...speculated);
    }

    // Final fallback: use feed.directory API for bot-protected sites
    if (feeds.length === 0) {
      const apiFeeds = await discoverViaApi(normalizedUrl);
      feeds.push(...apiFeeds);
    }

    return feeds;
  } catch {
    return [];
  }
}

// ─── Pattern Speculation Fallback ───────────────────────────────────────────

async function speculateFeedUrls(url: string): Promise<DiscoveredFeed[]> {
  try {
    const parsed = new URL(url);
    const basePath = parsed.pathname.replace(/\/$/, '');
    const origin = parsed.origin;

    const candidates = [
      origin + basePath + '/feed',
      origin + basePath + '/rss',
      origin + basePath + '/feed.xml',
      origin + basePath + '/rss.xml',
      origin + '/feed',
      origin + '/rss',
    ];

    // Deduplicate (e.g. if basePath is already /feed)
    const unique = [...new Set(candidates)];

    // Validate in parallel with short timeout, take first valid
    const results = await Promise.allSettled(
      unique.map(async (feedUrl) => {
        const valid = await validateRssUrlQuick(feedUrl);
        return valid ? feedUrl : null;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const name = extractNameFromUrl(url);
        const favicon = extractFavicon(url);
        const category = guessCategory(name + ' ' + result.value);
        return [{ name, rssUrl: result.value, url, favicon, category }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// Quick validation with shorter timeout for speculation
async function validateRssUrlQuick(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/xml, application/rss+xml, application/atom+xml, text/xml, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const text = await response.text();
    return text.includes('<rss') || text.includes('<feed') || text.includes('<channel') || text.includes('<entry');
  } catch {
    return false;
  }
}

// ─── API Fallback (feed.directory) ──────────────────────────────────────────

async function discoverViaApi(url: string): Promise<DiscoveredFeed[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(`https://feed.directory/${encodeURIComponent(url)}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const data = await response.json();
    const results = data?.feeds || data?.results || [];

    return results.map((feed: any) => {
      const rssUrl = feed.feedUrl || feed.feed_url || feed.url || '';
      const name = feed.title || feed.name || extractNameFromUrl(url);
      return {
        name,
        rssUrl,
        url,
        favicon: extractFavicon(url),
        category: guessCategory(name + ' ' + rssUrl),
      };
    }).filter((f: DiscoveredFeed) => f.rssUrl);
  } catch {
    return [];
  }
}

// ─── Validate an RSS URL ────────────────────────────────────────────────────

export async function validateRssUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/xml, application/rss+xml, application/atom+xml, text/xml, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const text = await response.text();
    return text.includes('<rss') || text.includes('<feed') || text.includes('<channel') || text.includes('<entry');
  } catch {
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.hostname.replace('www.', '').split('.');
    if (parts.length >= 2) {
      parts.pop();
    }
    return parts
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  } catch {
    return 'Unknown Feed';
  }
}

function extractFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return '';
  }
}

function guessCategory(text: string): ArticleCategory {
  const t = text.toLowerCase();

  const categoryKeywords: Record<ArticleCategory, string[]> = {
    AI: ['ai', 'machine learning', 'ml', 'gpt', 'llm', 'neural', 'openai', 'anthropic', 'hugging', 'deep learning'],
    Frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'css', 'frontend', 'ui', 'web', 'expo', 'next'],
    Backend: ['node', 'python', 'rust', 'go', 'java', 'ruby', 'backend', 'api', 'database', 'server'],
    Infrastructure: ['kubernetes', 'docker', 'aws', 'cloud', 'devops', 'terraform', 'infra', 'azure'],
    Security: ['security', 'hack', 'cyber', 'vulnerability', 'breach', 'encrypt'],
    Career: ['career', 'job', 'salary', 'hiring', 'interview', 'resume'],
    Tools: ['git', 'github', 'vscode', 'figma', 'tool', 'cli', 'sdk'],
    General: ['tech', 'news', 'blog', 'code', 'programming', 'developer'],
  };

  let bestCategory: ArticleCategory = 'General';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;
    for (const kw of keywords) {
      if (t.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as ArticleCategory;
    }
  }

  return bestCategory;
}
