import { XMLParser } from 'fast-xml-parser';
import { ArticleInput } from '@/types';
import { stripHtml, extractImageFromHtml } from '@/utils/html';
import { calculateImportanceScore } from './ranking';
import { getEnabledFeeds, getDisabledFeeds, getCustomFeeds, getFeedCache, saveFeedCache } from './db';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ['item', 'entry'].includes(name),
  processEntities: false,
  htmlEntities: false,
});

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

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export async function fetchAndParseFeed(
  url: string,
  sourceName: string,
  iconUri?: string,
  skipCache: boolean = false,
  keywords?: string[]
): Promise<ArticleInput[]> {
  try {
    const now = Date.now();
    let xml: string;

    // Check cache if not skipping
    if (!skipCache) {
      const cached = await getFeedCache(url);
      if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
        console.log(`[RSS] ${sourceName}: using cached feed (${Math.round((now - cached.fetchedAt) / 1000)}s old)`);
        xml = cached.content;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        // Prepare headers for conditional request
        const headers: Record<string, string> = {
          'User-Agent': 'DevJournal/1.0 (https://github.com/devjournal-app)',
          'Accept': 'application/xml, application/rss+xml, application/atom+xml, text/xml, */*',
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

    for (const item of items) {
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

    // Keyword filter: if keywords provided, only keep articles matching at least one
    const relevantArticles = keywords && keywords.length > 0
      ? allArticles.filter((a) => {
          const text = `${a.title} ${a.summary}`.toLowerCase();
          return keywords.some((kw) => text.includes(kw.toLowerCase()));
        })
      : allArticles;

    if (keywords && keywords.length > 0 && relevantArticles.length < allArticles.length) {
      console.log(`[RSS] ${sourceName}: keyword filter kept ${relevantArticles.length}/${allArticles.length} articles`);
    }

    // Filter to last 7 days only, no cascade, no limit
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    return relevantArticles
      .filter((a) => a.pub_date >= cutoff)
      .sort((a, b) => b.pub_date - a.pub_date);
  } catch (error) {
    console.error(`[RSS] Failed to fetch ${sourceName}:`, error);
    return [];
  }
}

export async function fetchAllFeeds(skipCache: boolean = false): Promise<ArticleInput[]> {
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
      fetchAndParseFeed(source.rss_url, source.name, source.icon, skipCache)
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
