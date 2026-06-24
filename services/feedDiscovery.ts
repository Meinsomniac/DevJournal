import { XMLParser } from 'fast-xml-parser';

export interface DiscoveredFeed {
  name: string;
  rssUrl: string;
  url: string;
  favicon: string;
}

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

const xmlParser = new XMLParser({ ignoreAttributes: false });

function isRssOrAtom(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('<')) return false;
  try {
    const parsed = xmlParser.parse(trimmed);
    return !!(parsed?.rss || parsed?.feed);
  } catch {
    return false;
  }
}

function looksLikeFeedUrl(url: string): boolean {
  const path = url.replace(/^https?:\/\/[^\/]+/i, '');
  return /\.(xml|rss|atom)$/i.test(path)
    || /\/feed\/?$/i.test(path)
    || /\/rss\/?$/i.test(path)
    || /\/atom\/?$/i.test(path);
}

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function extractTagAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function resolveUrl(href: string, base: string): string {
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) {
    try {
      const b = new URL(base);
      return b.origin + href;
    } catch { return href; }
  }
  try {
    return new URL(href, base).href;
  } catch { return href; }
}

function extractLinkTags(html: string, baseUrl: string): DiscoveredFeed[] {
  const feeds: DiscoveredFeed[] = [];
  const seen = new Set<string>();
  const clean = stripHtmlComments(html);
  const linkRegex = /<link\b[^>]*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(clean)) !== null) {
    const attrs = extractTagAttributes(match[0]);
    const rel = (attrs.rel || '').toLowerCase();
    const type = (attrs.type || '').toLowerCase();
    const href = attrs.href;

    if (!href) continue;
    if (rel !== 'alternate' && rel !== 'self') continue;

    const isFeedType = type.includes('rss') || type.includes('atom');
    const isXmlType = type.includes('xml');
    const hasFeedRel = rel === 'self' && isFeedType;

    if (!isFeedType && !isXmlType && !hasFeedRel) continue;

    const rssUrl = resolveUrl(href, baseUrl);
    if (seen.has(rssUrl)) continue;
    seen.add(rssUrl);

    const name = attrs.title || extractNameFromUrl(baseUrl);
    feeds.push({
      name,
      rssUrl,
      url: baseUrl,
      favicon: extractFavicon(baseUrl),
    });
  }

  return feeds;
}

function extractAnchorFeedLinks(html: string, baseUrl: string): DiscoveredFeed[] {
  const feeds: DiscoveredFeed[] = [];
  const seen = new Set<string>();
  const clean = stripHtmlComments(html);
  const feedWords = /rss|atom|feed|subscribe|xml/i;

  const anchorRegex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(clean)) !== null) {
    const tag = match[0];
    const attrs = extractTagAttributes(tag);
    const href = attrs.href;
    if (!href) continue;

    const text = tag.replace(/<[^>]*>/g, '').trim();
    const hasFeedWord = feedWords.test(href) || feedWords.test(text);
    const isFeedPath = /\.(xml|rss|atom)$/i.test(href) || /\/feed\/?$/i.test(href) || /\/rss\/?$/i.test(href);

    if (!hasFeedWord && !isFeedPath) continue;

    const rssUrl = resolveUrl(href, baseUrl);
    if (seen.has(rssUrl)) continue;
    seen.add(rssUrl);

    feeds.push({
      name: text || extractNameFromUrl(baseUrl),
      rssUrl,
      url: baseUrl,
      favicon: extractFavicon(baseUrl),
    });
  }

  return feeds;
}

const COMMON_FEED_PATHS = [
  '/feed', '/feed.xml', '/feed/',
  '/rss', '/rss.xml', '/rss/',
  '/atom.xml', '/atom/',
  '/feeds/posts/default',
  '/feeds/posts/default?alt=rss',
  '/index.xml', '/index.rss', '/index.atom',
  '/feed.atom', '/feed.rss',
  '/blog/feed', '/blog/feed.xml', '/blog/feed/',
  '/blog/rss', '/blog/rss.xml', '/blog/rss/',
  '/blog/atom.xml',
  '/posts/feed', '/posts/feed.xml',
  '/posts/rss', '/posts/rss.xml',
  '/news/feed', '/news/feed.xml',
  '/news/rss', '/news/rss.xml',
  '/en/feed/', '/en/feed',
  '/blog', '/blog.xml',
  '/articles/feed', '/articles/rss',
  '/latest/feed', '/latest/rss',
  '/rss/feed', '/rss/feed.xml',
  '/feeds/feed.xml',
  '/feeds/rss.xml',
  '/feeds/atom.xml',
  '/wp-json/wp/v2/posts',
  '/wp-json',
  '/?feed=rss2',
  '/?feed=atom',
];

function buildSpeculationCandidates(url: string): string[] {
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    const path = parsed.pathname.replace(/\/$/, '');
    const candidates: string[] = [];

    for (const p of COMMON_FEED_PATHS) {
      candidates.push(origin + p);
      if (path && path !== '') {
        candidates.push(origin + path + p);
      }
    }

    // Also try subdomain pattern: feed.domain.com
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3) {
      const domain = hostParts.slice(-2).join('.');
      candidates.push(`https://feeds.${domain}`);
      candidates.push(`https://feed.${domain}`);
    }

    return [...new Set(candidates)];
  } catch {
    return [];
  }
}

async function tryDirectFeed(url: string): Promise<DiscoveredFeed | null> {
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

    if (!response.ok) return null;

    // Check content-type first
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('xml') && !ct.includes('rss') && !ct.includes('atom') && !ct.includes('text')) return null;

    const text = await response.text();
    if (!isRssOrAtom(text)) return null;

    const name = extractNameFromUrl(url);
    return {
      name,
      rssUrl: url,
      url,
      favicon: extractFavicon(url),
    };
  } catch {
    return null;
  }
}

async function speculateFeeds(url: string): Promise<DiscoveredFeed[]> {
  const candidates = buildSpeculationCandidates(url);
  if (candidates.length === 0) return [];

  const results: DiscoveredFeed[] = [];
  const seenUrl = new Set<string>();

  // Test in batches of 10 to avoid overwhelming the network
  for (let i = 0; i < candidates.length; i += 10) {
    const batch = candidates.slice(i, i + 10);
    const batchResults = await Promise.allSettled(
      batch.map(async (feedUrl) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(feedUrl, {
            headers: {
              'User-Agent': BROWSER_UA,
              'Accept': 'application/xml, application/rss+xml, application/atom+xml, text/xml, */*',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) return null;

          const text = await response.text();
          if (!isRssOrAtom(text)) return null;

          return feedUrl;
        } catch {
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value && !seenUrl.has(result.value)) {
        seenUrl.add(result.value);
        results.push({
          name: extractNameFromUrl(url),
          rssUrl: result.value,
          url,
          favicon: extractFavicon(url),
        });
      }
    }
  }

  return results;
}

// ─── Feed Ranking & Dedup ────────────────────────────────────────────────────

type FeedSource = 'link-tag' | 'anchor' | 'speculation';

interface ScoredFeed extends DiscoveredFeed {
  source: FeedSource;
  score: number;
}

function getFeedFormat(url: string): 'rss' | 'atom' | 'json' | 'other' {
  const u = url.toLowerCase();
  if (u.includes('atom')) return 'atom';
  if (u.includes('rss')) return 'rss';
  if (u.includes('json')) return 'json';
  // Common CMS feed paths like /feed/, /feed, /rss/, /rss
  if (/\/(feed|rss)(\/|$)/.test(u)) return 'rss';
  if (/\.(xml)$/i.test(u)) return 'rss';
  return 'other';
}

function getFeedIdentity(url: string): string {
  const u = url.toLowerCase().replace(/\/+$/, '');
  const format = getFeedFormat(u);
  // Query-param WordPress feeds
  if (/\?feed=(rss2?|atom)/.test(u)) return u.includes('atom') ? 'atom-wp' : 'rss-wp';
  // Key by directory path so /feed/ and /comments/feed/ don't collide
  let path: string;
  try { path = new URL(u).pathname.replace(/\/+$/, '') || '/'; } catch { return u; }
  // Normalize WordPress /feed/rss → /feed (same content)
  const key = path.replace(/\/feed\/rss(\/.*)?$/, '/feed').replace(/\/feed\/rss$/, '/feed');
  return format + ':' + key;
}

function scoreFeed(source: FeedSource, format: string, url: string): number {
  let score = 0;
  switch (source) {
    case 'link-tag': score += 100; break;
    case 'anchor':   score += 50;  break;
    case 'speculation': score += 10; break;
  }
  if (format === 'rss') score += 5;
  // Penalise query-param feeds
  try { if (new URL(url).search) score -= 10; } catch { /* skip */ }
  return score;
}

function deduplicateAndRankFeeds(
  feeds: DiscoveredFeed[],
  source: FeedSource,
  existingUrls: Set<string>
): ScoredFeed[] {
  const seenIdentity = new Set<string>();
  const result: ScoredFeed[] = [];
  for (const f of feeds) {
    // Skip if discovered URL matches the source page URL — almost always a false positive
    if (f.rssUrl === f.url) continue;
    if (existingUrls.has(f.rssUrl)) continue;
    existingUrls.add(f.rssUrl);
    const identity = getFeedIdentity(f.rssUrl);
    if (seenIdentity.has(identity)) continue;
    seenIdentity.add(identity);
    result.push({ ...f, source, score: scoreFeed(source, getFeedFormat(f.rssUrl), f.rssUrl) });
  }
  return result;
}

function selectBestFeeds(scored: ScoredFeed[]): DiscoveredFeed[] {
  if (scored.length <= 1) return scored;
  scored.sort((a, b) => b.score - a.score);
  const seenFormats = new Set<string>();
  const picked: DiscoveredFeed[] = [];
  for (const f of scored) {
    const fmt = getFeedFormat(f.rssUrl);
    if (picked.length >= 2) break;
    if (!seenFormats.has(fmt)) {
      seenFormats.add(fmt);
      const { source, score, ...clean } = f;
      picked.push(clean);
    }
  }
  return picked.length > 0 ? picked : [scored[0]];
}

// ─── Main Discovery ──────────────────────────────────────────────────────────

export async function discoverRssFromUrl(url: string): Promise<DiscoveredFeed[]> {
  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Step 1: If the URL itself looks like a feed, try it directly
    if (looksLikeFeedUrl(normalizedUrl)) {
      const direct = await tryDirectFeed(normalizedUrl);
      if (direct) return [direct];
    }

    // Step 2: Fetch the page as HTML
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml,*/*',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Step 3: Check if the response itself is an RSS/Atom feed
    if (isRssOrAtom(text)) {
      const name = extractNameFromUrl(normalizedUrl);
      return [{
        name,
        rssUrl: normalizedUrl,
        url: normalizedUrl,
        favicon: extractFavicon(normalizedUrl),
      }];
    }

    // If content-type isn't HTML, bail
    if (!contentType.includes('html') && !contentType.includes('xml')) return [];

    const baseUrl = response.url || normalizedUrl;
    const allScored: ScoredFeed[] = [];
    const seenUrls = new Set<string>();

    // Step 4: Parse <link> tags in HTML (highest authority)
    const linkFeeds = extractLinkTags(text, baseUrl);
    allScored.push(...deduplicateAndRankFeeds(linkFeeds, 'link-tag', seenUrls));

    // Step 5: Scan <a> tags for feed links
    if (allScored.length === 0) {
      const anchorFeeds = extractAnchorFeedLinks(text, baseUrl);
      allScored.push(...deduplicateAndRankFeeds(anchorFeeds, 'anchor', seenUrls));
    }

    // Step 6: Fallback to path speculation
    if (allScored.length === 0) {
      const speculated = await speculateFeeds(normalizedUrl);
      allScored.push(...deduplicateAndRankFeeds(speculated, 'speculation', seenUrls));
    }

    return selectBestFeeds(allScored);
  } catch {
    return [];
  }
}

// ─── Validate an RSS URL ─────────────────────────────────────────────────────

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
    return isRssOrAtom(text);
  } catch {
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.hostname.replace('www.', '').split('.');
    if (parts.length >= 2) parts.pop();
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
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


