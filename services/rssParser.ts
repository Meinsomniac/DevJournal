import { XMLParser } from 'fast-xml-parser';
import { load } from 'cheerio';
import { ArticleInput } from '@/types';
import { stripHtml, extractImageFromHtml } from '@/utils/html';
import { calculateImportanceScore } from './ranking';
import { getEnabledFeeds, getDisabledFeeds, getCustomFeeds, getFeedCache, saveFeedCache, filterExistingArticles } from './db';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['item', 'entry'].includes(name),
  processEntities: false,
  htmlEntities: false,
});

const CONCURRENCY_LIMIT = 2;
const YIELD_INTERVAL = 50;

async function limitedConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const task of tasks) {
    const p = task().then(r => { results.push(r); });
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
      const idx = executing.findIndex(e => e === p);
      if (idx >= 0) executing.splice(idx, 1);
    }
  }
  await Promise.all(executing);
  return results;
}

function yieldIfNeeded(counter: number): Promise<void> {
  if (counter % YIELD_INTERVAL === 0) {
    return new Promise(resolve => setTimeout(resolve, 0));
  }
  return Promise.resolve();
}

interface RawFeedItem {
  title?: string;
  link?: string | { '@_href': string } | { href: string };
  id?: string;
  guid?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
  'dc:date'?: string;
  summary?: string;
  description?: string;
  content?: string;
  'content:encoded'?: string;
  'media:thumbnail'?: { '@_url': string } | { url: string } | string;
  enclosure?: { '@_url': string; '@_type': string } | { url: string; type: string };
  author?: { name?: string } | string;
  category?: string | string[];
}

function extractLink(item: RawFeedItem): string | null {
  // RSS 2.0: link is direct string
  if (typeof item.link === 'string' && item.link) {
    return item.link;
  }

  // Atom: link object with href
  if (item.link && typeof item.link === 'object') {
    if ('@_href' in item.link) return item.link['@_href'];
    if ('href' in item.link) return item.link.href;
  }

  // Fallback to id or guid
  if (item.id) return item.id;
  if (typeof item.guid === 'string') return item.guid;

  // Enclosure URL as last resort
  if (item.enclosure) {
    if ('@_url' in item.enclosure) return item.enclosure['@_url'];
    if ('url' in item.enclosure) return item.enclosure.url;
  }

  return null;
}

function extractDate(item: RawFeedItem): number {
  const dateStr = item.pubDate || item.published || item.updated || item['dc:date'];

  if (!dateStr) return Date.now();

  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

function isLowQualitySummary(text: string, title: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 50) return true;
  if (/^(article\s*url|comments?\s*url|url)\s*:/i.test(t)) return true;
  if (t === title.trim().toLowerCase()) return true;
  return false;
}

function extractSummary(item: RawFeedItem): string {
  const title = extractTitle(item);

  const candidates = [
    item['content:encoded'],
    item.content,
    item.description,
    item.summary,
  ].filter((f): f is string => typeof f === 'string' && f.length > 0);

  for (const text of candidates) {
    const cleaned = stripHtml(text).substring(0, 500);
    if (!isLowQualitySummary(cleaned, title)) return cleaned;
  }

  const all = candidates.map(f => stripHtml(f).substring(0, 500)).filter(f => f.length > 0);
  return all.length > 0 ? all.reduce((a, b) => a.length >= b.length ? a : b) : '';
}

function extractTitle(item: RawFeedItem): string {
  const raw = item.title || 'Untitled';
  return stripHtml(raw);
}

function extractImage(item: RawFeedItem): string | undefined {
  // 1. media:thumbnail (common in RSS)
  if (item['media:thumbnail']) {
    const t = item['media:thumbnail'];
    if (typeof t === 'string') return t;
    if ('@_url' in t) return t['@_url'];
    if ('url' in t) return t.url;
  }

  // 2. enclosure image
  if (item.enclosure) {
    const enc = item.enclosure;
    const url = '@_url' in enc ? enc['@_url'] : enc.url;
    const type = '@_type' in enc ? enc['@_type'] : enc.type;
    if (url && type?.startsWith('image/')) return url;
  }

  // 3. Extract from content
  const content = item['content:encoded'] || item.content || item.description || '';
  return extractImageFromHtml(content);
}

async function fetchArticleContent(url: string): Promise<{ summary?: string; image?: string } | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevJournal/1.0 (https://github.com/devjournal-app)',
      },
      signal: controller.signal,
    });

    if (!response.ok) return undefined;

    // Truncate before parsing — og:image/meta tags sit near the top, so this
    // drastically cuts cheerio's synchronous parse cost (keeps the UI thread free).
    const html = (await response.text()).slice(0, 200000);
    const $ = load(html);

    // Extract image from meta tags or first img
    let image: string | undefined;

    // 1. og:image
    $('meta[property="og:image"], meta[name="og:image"]').each((_, el) => {
      const val = $(el).attr('content');
      if (val && !image) image = val;
    });

    // 2. twitter:image
    if (!image) {
      $('meta[name="twitter:image"], meta[property="twitter:image"]').each((_, el) => {
        const val = $(el).attr('content');
        if (val && !image) image = val;
      });
    }

    // 3. First <img> in article content
    if (!image) {
      $('article img, main img, .content img, .post img, .entry-content img').each((_, el) => {
        const val = $(el).attr('src');
        if (val && !image) image = val;
      });
    }

    // Make relative URLs absolute
    if (image && image.startsWith('/')) {
      try {
        const base = new URL(url);
        image = `${base.protocol}//${base.host}${image}`;
      } catch { /* keep relative */ }
    }

    // Extract summary
    $('script, style, nav, footer, header, aside, .sidebar, .menu, .ad, .advertisement, noscript').remove();

    let summary: string | undefined;
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 80 && text.length < 500 && !summary) {
        summary = text;
      }
    });

    return { summary: summary || undefined, image: image || undefined };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

function generateId(link: string, title: string, pubDate: number): string {
  // Simple hash function for ID generation
  const seed = link || `${title}-${pubDate}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes default

interface FeedFrequency {
  lastFetched: number;
  intervalMs: number;
}

const feedFrequencyMap = new Map<string, FeedFrequency>();

function getAdaptiveTTL(url: string): number {
  const freq = feedFrequencyMap.get(url);
  if (!freq) return CACHE_TTL_MS;
  
  const now = Date.now();
  const timeSinceLastFetch = now - freq.lastFetched;
  
  if (timeSinceLastFetch < freq.intervalMs * 0.5) {
    return Math.max(freq.intervalMs, 5 * 60 * 1000);
  }
  return freq.intervalMs;
}

function updateFeedFrequency(url: string): void {
  const now = Date.now();
  const freq = feedFrequencyMap.get(url);
  if (freq) {
    const observedInterval = now - freq.lastFetched;
    freq.intervalMs = Math.round((freq.intervalMs * 0.7) + (observedInterval * 0.3));
    freq.intervalMs = Math.max(5 * 60 * 1000, Math.min(freq.intervalMs, 6 * 60 * 60 * 1000));
    freq.lastFetched = now;
  } else {
    feedFrequencyMap.set(url, { lastFetched: now, intervalMs: 60 * 60 * 1000 });
  }
}

export async function fetchAndParseFeed(
  url: string,
  sourceName: string,
  iconUri?: string,
  skipCache: boolean = false,
  keywords?: string[],
  enrich: boolean = true
): Promise<ArticleInput[]> {
  try {
    const now = Date.now();
    let xml: string;

    const adaptiveTTL = skipCache ? 0 : getAdaptiveTTL(url);

    // Check cache if not skipping
    if (!skipCache) {
      const cached = await getFeedCache(url);
      if (cached && (now - cached.fetchedAt) < adaptiveTTL) {
        console.log(`[RSS] ${sourceName}: using cached feed (${Math.round((now - cached.fetchedAt) / 1000)}s old)`);
        xml = cached.content;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        // Prepare headers for conditional request
        const headers: Record<string, string> = {
          'User-Agent': 'DevJournal/1.0 (https://github.com/devjournal-app)',
          'Accept': 'application/xml, application/rss+xml, application/atom+xml, text/xml, */*',
          'Accept-Encoding': 'gzip, deflate',
        };

        // Add If-Modified-Since and If-None-Match if we have cached data
        if (cached) {
          if (cached.lastModified) {
            headers['If-Modified-Since'] = cached.lastModified;
          }
          if (cached.etag) {
            headers['If-None-Match'] = cached.etag;
          }
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 304) {
          // Not modified, use cached content
          console.log(`[RSS] ${sourceName}: 304 Not Modified, using cached feed`);
          if (cached) {
            xml = cached.content;
            // Update cache timestamp but keep same content
            await saveFeedCache(url, cached.content, cached.lastModified, cached.etag);
          } else {
            console.warn(`[RSS] ${sourceName}: 304 Not Modified but no cached content`);
            return [];
          }
        } else if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        } else {
          // Got new content, save it with ETag and Last-Modified
          xml = await response.text();
          
          const lastModified = response.headers.get('Last-Modified');
          const etag = response.headers.get('ETag');
          await saveFeedCache(url, xml, lastModified, etag);
        }
      }
    } else {
      // Skip cache entirely (for auto-refetch)
      console.log(`[RSS] ${sourceName}: skipping cache`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'DevJournal/1.0 (https://github.com/devjournal-app)',
          'Accept': 'application/xml, application/rss+xml, application/atom+xml, text/xml, */*',
          'Accept-Encoding': 'gzip, deflate',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      xml = await response.text();
      
      // Save to cache for future use
      const lastModified = response.headers.get('Last-Modified');
      const etag = response.headers.get('ETag');
      await saveFeedCache(url, xml, lastModified, etag);
    }

    if (!xml.includes('<') || xml.length < 50) {
      console.warn(`[RSS] ${sourceName}: empty or invalid response (${xml.length} bytes)`);
      return [];
    }

    const json = parser.parse(xml);

    let items: RawFeedItem[] = [];

    if (json.rss?.channel?.item) {
      items = json.rss.channel.item;
    } else if (json.feed?.entry) {
      items = json.feed.entry;
    } else if (json.channel?.item) {
      items = json.channel.item;
    } else if (json.rdf?.item) {
      items = json.rdf.item;
    } else if (json.items) {
      items = json.items;
    }

    if (!Array.isArray(items)) {
      items = [items].filter(Boolean);
    }

    // Parse all items into ArticleInput once
    const allArticles: ArticleInput[] = [];

    for (let i = 0; i < items.length; i++) {
      await yieldIfNeeded(i);
      const item = items[i];
      try {
        const link = extractLink(item);
        if (!link) continue;

        const title = extractTitle(item);
        const pubDate = extractDate(item);
        const summary = extractSummary(item);
        const imageUri = extractImage(item);

        const id = generateId(link, title, pubDate);
        const importanceScore = calculateImportanceScore(title, summary, sourceName);

        allArticles.push({
          id,
          title,
          link,
          source_name: sourceName,
          source_icon_uri: iconUri,
          pub_date: pubDate,
          fetched_at: now,
          summary,
          image_uri: imageUri,
          importance_score: importanceScore,
        });
      } catch (itemError) {
        console.error(`Failed to parse item from ${sourceName}:`, itemError);
      }
    }

    // KEYWORD FILTER FIRST - before expensive content enrichment
    const relevantArticles = keywords && keywords.length > 0
      ? allArticles.filter((a) => {
          const text = `${a.title} ${a.summary}`.toLowerCase();
          return keywords.some((kw) => text.includes(kw.toLowerCase()));
        })
      : allArticles;

    if (keywords && keywords.length > 0 && relevantArticles.length < allArticles.length) {
      console.log(`[RSS] ${sourceName}: keyword filter kept ${relevantArticles.length}/${allArticles.length} articles`);
    }

    // Filter to last 7 days before enrichment
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const recentArticles = relevantArticles
      .filter((a) => a.pub_date >= cutoff)
      .sort((a, b) => b.pub_date - a.pub_date);

    // Batch check existing articles - single DB query
    const newArticles = await filterExistingArticles(recentArticles);

    // Fetch missing summaries and images from article pages with concurrency limit.
    // Skipped when `enrich` is false so the interactive fetch returns fast and the
    // heavy HTML parsing runs in the background instead of blocking the UI thread.
    if (enrich) {
      const contentFetchTasks = newArticles.map((article) => async () => {
        const needsSummary = !article.summary || isLowQualitySummary(article.summary, article.title);
        const needsImage = !article.image_uri;
        if (!needsSummary && !needsImage) return;

        const result = await fetchArticleContent(article.link);
        if (!result) return;

        if (needsSummary && result.summary) {
          article.summary = result.summary;
        }
        if (needsImage && result.image) {
          article.image_uri = result.image;
        }
      });

      await limitedConcurrency(contentFetchTasks, CONCURRENCY_LIMIT);
    }

    updateFeedFrequency(url);
    return newArticles;
  } catch (error) {
    console.error(`[RSS] Failed to fetch ${sourceName}:`, error);
    return [];
  }
}

export async function fetchAllFeeds(skipCache: boolean = false, enrich: boolean = true): Promise<ArticleInput[]> {
  const customFeeds = await getCustomFeeds();
  const enabledIds = await getEnabledFeeds();
  const disabledIds = await getDisabledFeeds();

  const hasPreferences = enabledIds.length > 0 || disabledIds.length > 0;

  const activeSources = customFeeds.filter((feed) => {
    if (!hasPreferences) return true;
    return enabledIds.includes(feed.id);
  });

  const results = await Promise.allSettled(
    activeSources.map(source =>
      fetchAndParseFeed(source.rss_url, source.name, source.icon, skipCache, undefined, enrich)
    )
  );

  const allArticles: ArticleInput[] = [];
  let errors = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
    } else {
      errors++;
      console.error(`[RSS] Feed failed: ${activeSources[index].name}`, result.reason);
    }
  });

  console.log(`[RSS] Fetched ${allArticles.length} articles from ${activeSources.length - errors}/${activeSources.length} feeds`);

  return allArticles;
}

/**
 * Enrich already-saved articles with summaries/images fetched from their pages.
 * Runs the per-article HTML parsing in the background, a few at a time, yielding
 * to the event loop between batches so the UI thread stays responsive (navigation
 * taps keep working during the fetch). Mutates and returns the articles that were
 * enriched so the caller can persist the changes.
 */
export async function enrichArticles(
  articles: ArticleInput[],
  onProgress?: (done: number, total: number) => void
): Promise<ArticleInput[]> {
  const toEnrich = articles.filter((a) =>
    (!a.summary || isLowQualitySummary(a.summary, a.title)) || !a.image_uri
  );

  const total = toEnrich.length;
  let done = 0;
  onProgress?.(0, total);

  const BATCH_SIZE = 2;
  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (article) => {
      const result = await fetchArticleContent(article.link);
      if (!result) return;
      if ((!article.summary || isLowQualitySummary(article.summary, article.title)) && result.summary) {
        article.summary = result.summary;
      }
      if (!article.image_uri && result.image) {
        article.image_uri = result.image;
      }
      done++;
    }));
    onProgress?.(done, total);
    // Yield so React Native can process queued touch events between batches.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return toEnrich;
}
