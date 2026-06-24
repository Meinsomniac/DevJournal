import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Article, ArticleInput, CustomFeed, FeedSource, FilterState } from '@/types';

export interface StorageStats {
  count: number;
  oldestDate: number | null;
  storageMb: number;
}

interface DatabaseInterface {
  saveArticles(articles: ArticleInput[]): Promise<number>;
  pruneOldArticles(): Promise<number>;
  getDigestFeed(limit?: number, offset?: number, sortOrder?: 'newest' | 'oldest'): Promise<Article[]>;
  getBookmarks(): Promise<Article[]>;
  getHistory(limit?: number): Promise<Article[]>;
  searchArticles(query: string, limit?: number): Promise<Article[]>;
  getArticleById(id: string): Promise<Article | null>;
  toggleBookmark(id: string): Promise<boolean>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
  deleteBookmark(id: string): Promise<void>;
  getUnreadCount(): Promise<number>;
  getArticleCount(): Promise<number>;
  getStorageStats(): Promise<StorageStats>;
  getSetting<T>(key: string, defaultValue: T): Promise<T>;
  setSetting<T>(key: string, value: T): Promise<void>;
  setFeedEnabled(id: string, enabled: boolean): Promise<void>;
  getEnabledFeeds(): Promise<string[]>;
  getDisabledFeeds(): Promise<string[]>;
  addCustomFeed(feed: CustomFeed): Promise<void>;
  removeCustomFeed(id: string): Promise<void>;
  getCustomFeeds(): Promise<CustomFeed[]>;
  clearAllData(): Promise<void>;
  clearCache(): Promise<void>;
  getArticlesBySource(sourceName: string, limit?: number): Promise<Article[]>;
  searchArticlesBySource(query: string, sourceName: string, limit?: number): Promise<Article[]>;
  getEnabledFeedSources(): Promise<FeedSource[]>;
  getFilteredArticles(filters: FilterState, searchText?: string, limit?: number, offset?: number): Promise<Article[]>;
  retainOnlyFeeds(keepIds: Set<string>): Promise<void>;
  getNotifiedArticleIds(): Promise<Set<string>>;
  markArticlesNotified(ids: string[]): Promise<void>;
  getFeedCache(url: string): Promise<{ content: string; lastModified: string | null; etag: string | null; fetchedAt: number } | null>;
  saveFeedCache(url: string, content: string, lastModified: string | null, etag: string | null): Promise<void>;
  clearFeedCache(): Promise<void>;
}

// ─── Native SQLite implementation ────────────────────────────────────────────

class NativeDatabase implements DatabaseInterface {
  private dbPromise: Promise<SQLite.SQLiteDatabase>;

  constructor() {
    this.dbPromise = this.initDb();
  }

  private async initDb(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync('devjournal.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        link TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_icon_uri TEXT,
        pub_date INTEGER NOT NULL,
        fetched_at INTEGER NOT NULL,
        summary TEXT,
        image_uri TEXT,
        importance_score INTEGER NOT NULL DEFAULT 1,
        is_bookmarked INTEGER NOT NULL DEFAULT 0,
        is_read INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date);
      CREATE INDEX IF NOT EXISTS idx_articles_importance ON articles(importance_score);
      CREATE INDEX IF NOT EXISTS idx_articles_bookmarked ON articles(is_bookmarked);
      CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(is_read);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feed_preferences (
        feed_id TEXT PRIMARY KEY NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS custom_feeds (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        rss_url TEXT NOT NULL,
        icon TEXT,
        added_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notified_articles (
        id TEXT PRIMARY KEY NOT NULL,
        notified_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feed_cache (
        url TEXT PRIMARY KEY NOT NULL,
        content TEXT NOT NULL,
        last_modified TEXT,
        etag TEXT,
        fetched_at INTEGER NOT NULL
      );
    `);

    // Migration v1: remove category column from old databases
    for (const table of ['articles', 'custom_feeds']) {
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      if (cols.some(c => c.name === 'category')) {
        try {
          await db.execAsync(`ALTER TABLE ${table} DROP COLUMN category`);
        } catch {
          // DROP COLUMN not supported (old SQLite) — recreate table
          if (table === 'articles') {
            await db.execAsync(`
              CREATE TABLE articles_reborn (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                link TEXT NOT NULL,
                source_name TEXT NOT NULL,
                source_icon_uri TEXT,
                pub_date INTEGER NOT NULL,
                fetched_at INTEGER NOT NULL,
                summary TEXT,
                image_uri TEXT,
                importance_score INTEGER NOT NULL DEFAULT 1,
                is_bookmarked INTEGER NOT NULL DEFAULT 0,
                is_read INTEGER NOT NULL DEFAULT 0
              );
              INSERT INTO articles_reborn SELECT id, title, link, source_name, source_icon_uri, pub_date, fetched_at, summary, image_uri, importance_score, is_bookmarked, is_read FROM articles;
              DROP TABLE articles;
              ALTER TABLE articles_reborn RENAME TO articles;
              CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date);
              CREATE INDEX IF NOT EXISTS idx_articles_importance ON articles(importance_score);
              CREATE INDEX IF NOT EXISTS idx_articles_bookmarked ON articles(is_bookmarked);
              CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(is_read);
            `);
          } else {
            await db.execAsync(`
              CREATE TABLE custom_feeds_reborn (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                rss_url TEXT NOT NULL,
                icon TEXT,
                added_at INTEGER NOT NULL
              );
              INSERT INTO custom_feeds_reborn SELECT id, name, url, rss_url, icon, added_at FROM custom_feeds;
              DROP TABLE custom_feeds;
              ALTER TABLE custom_feeds_reborn RENAME TO custom_feeds;
            `);
          }
        }
      }
    }

    return db;
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    return this.dbPromise;
  }

  async saveArticles(articles: ArticleInput[]): Promise<number> {
    const db = await this.getDb();
    let inserted = 0;
    await db.withTransactionAsync(async () => {
      for (const a of articles) {
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM articles WHERE id = ?',
          [a.id]
        );
        if (!existing) {
          await db.runAsync(
            `INSERT INTO articles (id, title, link, source_name, source_icon_uri, pub_date, fetched_at, summary, image_uri, importance_score, is_bookmarked, is_read)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [a.id, a.title, a.link, a.source_name, a.source_icon_uri ?? null, a.pub_date, a.fetched_at, a.summary, a.image_uri ?? null, a.importance_score]
          );
          inserted++;
        }
      }
    });
    return inserted;
  }

  async pruneOldArticles(): Promise<number> {
    const db = await this.getDb();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const result = await db.runAsync(
      'DELETE FROM articles WHERE pub_date < ? AND is_bookmarked = 0',
      [cutoff]
    );
    return result.changes;
  }

  async getDigestFeed(limit = 50, offset = 0, sortOrder: 'newest' | 'oldest' = 'newest'): Promise<Article[]> {
    const db = await this.getDb();
    const { names: enabledNames, hasPrefs } = await this.getEnabledSourceNames();
    const dir = sortOrder === 'oldest' ? 'ASC' : 'DESC';

    if (hasPrefs && enabledNames.length === 0) return [];

    if (enabledNames.length > 0) {
      const placeholders = enabledNames.map(() => '?').join(',');
      return db.getAllAsync<Article>(
        `SELECT * FROM articles WHERE source_name IN (${placeholders}) ORDER BY pub_date ${dir} LIMIT ? OFFSET ?`,
        [...enabledNames, limit, offset]
      );
    }

    return db.getAllAsync<Article>(
      `SELECT * FROM articles ORDER BY pub_date ${dir} LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  private async getEnabledSourceNames(): Promise<{ names: string[]; hasPrefs: boolean }> {
    const db = await this.getDb();
    const allPrefs = await db.getAllAsync<{ feed_id: string; enabled: number }>(
      'SELECT feed_id, enabled FROM feed_preferences'
    );

    if (allPrefs.length === 0) return { names: [], hasPrefs: false };

    const enabledIds = new Set(
      allPrefs.filter(r => r.enabled === 1).map(r => r.feed_id)
    );

    const { FEED_SOURCES } = await import('@/constants/Feeds');
    const builtinIds = new Set(FEED_SOURCES.map(s => s.id));
    const builtinNames = FEED_SOURCES
      .filter(s => enabledIds.has(s.id))
      .map(s => s.name);

    const customs = await db.getAllAsync<{ id: string; name: string }>(
      'SELECT id, name FROM custom_feeds'
    );
    const customNames = customs
      .filter(c => enabledIds.has(c.id) && !builtinIds.has(c.id))
      .map(c => c.name);

    return { names: [...builtinNames, ...customNames], hasPrefs: true };
  }

  async getArticlesBySource(sourceName: string, limit = 50): Promise<Article[]> {
    const db = await this.getDb();
    const breaking = await db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE source_name = ? AND importance_score = 5 ORDER BY pub_date DESC LIMIT 10`,
      [sourceName]
    );
    const remaining = limit - breaking.length;
    const regular = await db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE source_name = ? AND importance_score < 5 ORDER BY importance_score DESC, pub_date DESC LIMIT ?`,
      [sourceName, remaining]
    );
    return [...breaking, ...regular];
  }

  async searchArticlesBySource(query: string, sourceName: string, limit = 50): Promise<Article[]> {
    const db = await this.getDb();
    const pattern = `%${query}%`;
    return db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE source_name = ? AND (title LIKE ? OR summary LIKE ?) ORDER BY pub_date DESC LIMIT ?`,
      [sourceName, pattern, pattern, limit]
    );
  }

  async getEnabledFeedSources(): Promise<FeedSource[]> {
    const db = await this.getDb();
    const allPrefs = await db.getAllAsync<{ feed_id: string; enabled: number }>(
      'SELECT feed_id, enabled FROM feed_preferences'
    );
    const { FEED_SOURCES } = await import('@/constants/Feeds');

    if (allPrefs.length === 0) return FEED_SOURCES;

    const enabledIds = new Set(
      allPrefs.filter(r => r.enabled === 1).map(r => r.feed_id)
    );

    const customs = await db.getAllAsync<{ id: string; name: string; url: string; icon?: string }>(
      'SELECT id, name, url, icon FROM custom_feeds'
    );

    const builtinIds = new Set(FEED_SOURCES.map(s => s.id));
    const builtinSources = FEED_SOURCES.filter(source => enabledIds.has(source.id));
    const customSources: FeedSource[] = customs
      .filter(c => enabledIds.has(c.id) && !builtinIds.has(c.id))
      .map(c => ({ id: c.id, name: c.name, url: c.url, icon: c.icon, enabled: true }));

    return [...builtinSources, ...customSources];
  }

  async getFilteredArticles(filters: FilterState, searchText?: string, limit = 50, offset = 0): Promise<Article[]> {
    const db = await this.getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    const { names: enabledNames, hasPrefs } = await this.getEnabledSourceNames();
    if (hasPrefs && enabledNames.length === 0) return [];
    if (enabledNames.length > 0) {
      conditions.push(`source_name IN (${enabledNames.map(() => '?').join(',')})`);
      params.push(...enabledNames);
    }

    if (searchText?.trim()) {
      const pattern = `%${searchText.trim()}%`;
      conditions.push('(title LIKE ? OR summary LIKE ?)');
      params.push(pattern, pattern);
    }

    if (filters.sourceNames.length > 0) {
      conditions.push(`source_name IN (${filters.sourceNames.map(() => '?').join(',')})`);
      params.push(...filters.sourceNames);
    }

    if (filters.minRating > 1) {
      conditions.push('importance_score >= ?');
      params.push(filters.minRating);
    }

    if (filters.datePreset) {
      const now = Date.now();
      let cutoff: number;
      switch (filters.datePreset) {
        case '24h': cutoff = now - 86400000; break;
        case '7d': cutoff = now - 604800000; break;
        case '30d': cutoff = now - 2592000000; break;
      }
      conditions.push('pub_date >= ?');
      params.push(cutoff);
    }

    if (conditions.length === 0) return this.getDigestFeed(limit, offset, filters.sortOrder);

    const whereClause = conditions.join(' AND ');
    const dir = filters.sortOrder === 'oldest' ? 'ASC' : 'DESC';
    return db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE ${whereClause} ORDER BY pub_date ${dir} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
  }

  async getBookmarks(): Promise<Article[]> {
    const db = await this.getDb();
    return db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE is_bookmarked = 1 ORDER BY pub_date DESC`
    );
  }

  async getHistory(limit = 100): Promise<Article[]> {
    const db = await this.getDb();
    return db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE is_read = 1 ORDER BY pub_date DESC LIMIT ?`,
      [limit]
    );
  }

  async searchArticles(query: string, limit = 50): Promise<Article[]> {
    const db = await this.getDb();
    const pattern = `%${query}%`;
    return db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE title LIKE ? OR summary LIKE ? ORDER BY pub_date DESC LIMIT ?`,
      [pattern, pattern, limit]
    );
  }

  async getArticleById(id: string): Promise<Article | null> {
    const db = await this.getDb();
    return db.getFirstAsync<Article>(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );
  }

  async toggleBookmark(id: string): Promise<boolean> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ is_bookmarked: number }>(
      'SELECT is_bookmarked FROM articles WHERE id = ?',
      [id]
    );
    if (!row) return false;
    const newVal = row.is_bookmarked ? 0 : 1;
    await db.runAsync(
      'UPDATE articles SET is_bookmarked = ? WHERE id = ?',
      [newVal, id]
    );
    return newVal === 1;
  }

  async markRead(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('UPDATE articles SET is_read = 1 WHERE id = ?', [id]);
  }

  async markAllRead(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('UPDATE articles SET is_read = 1');
  }

  async deleteBookmark(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('UPDATE articles SET is_bookmarked = 0 WHERE id = ?', [id]);
  }

  async getUnreadCount(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM articles WHERE is_read = 0'
    );
    return row?.count ?? 0;
  }

  async getArticleCount(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM articles'
    );
    return row?.count ?? 0;
  }

  async getStorageStats(): Promise<StorageStats> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number; oldestDate: number | null }>(
      'SELECT COUNT(*) as count, MIN(pub_date) as oldestDate FROM articles'
    );
    const count = row?.count ?? 0;
    const estimatedBytes = count * 2000;
    const storageMb = Math.round((estimatedBytes / (1024 * 1024)) * 10) / 10;
    return { count, oldestDate: row?.oldestDate ?? null, storageMb };
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    if (!row) return defaultValue;
    try { return JSON.parse(row.value) as T; } catch { return defaultValue; }
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, JSON.stringify(value)]
    );
  }

  async setFeedEnabled(id: string, enabled: boolean): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO feed_preferences (feed_id, enabled) VALUES (?, ?)',
      [id, enabled ? 1 : 0]
    );
  }

  async getEnabledFeeds(): Promise<string[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ feed_id: string }>(
      'SELECT feed_id FROM feed_preferences WHERE enabled = 1'
    );
    return rows.map(r => r.feed_id);
  }

  async getDisabledFeeds(): Promise<string[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ feed_id: string }>(
      'SELECT feed_id FROM feed_preferences WHERE enabled = 0'
    );
    return rows.map(r => r.feed_id);
  }

  async addCustomFeed(feed: CustomFeed): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO custom_feeds (id, name, url, rss_url, icon, added_at) VALUES (?, ?, ?, ?, ?, ?)',
      [feed.id, feed.name, feed.url, feed.rss_url, feed.icon ?? null, feed.added_at]
    );
  }

  async removeCustomFeed(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM custom_feeds WHERE id = ?', [id]);
  }

  async getCustomFeeds(): Promise<CustomFeed[]> {
    const db = await this.getDb();
    return db.getAllAsync<CustomFeed>('SELECT * FROM custom_feeds ORDER BY added_at DESC');
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM articles');
  }

  async clearCache(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM articles WHERE is_bookmarked = 0');
  }

  async retainOnlyFeeds(keepIds: Set<string>): Promise<void> {
    const db = await this.getDb();
    const placeholders = [...keepIds].map(() => '?').join(',');
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM custom_feeds WHERE id NOT IN (${placeholders})`, [...keepIds]);
      await db.runAsync(`DELETE FROM feed_preferences WHERE feed_id NOT IN (${placeholders})`, [...keepIds]);
      await db.runAsync(`DELETE FROM articles WHERE source_name NOT IN (SELECT name FROM custom_feeds WHERE id IN (${placeholders}))`, [...keepIds]);
    });
  }

  async getNotifiedArticleIds(): Promise<Set<string>> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM notified_articles');
    return new Set(rows.map(r => r.id));
  }

  async markArticlesNotified(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.getDb();
    const stmt = await db.prepareAsync('INSERT OR IGNORE INTO notified_articles (id) VALUES (?)');
    for (const id of ids) {
      await stmt.executeAsync(id);
    }
    await stmt.finalizeAsync();
  }

  async getFeedCache(url: string): Promise<{ content: string; lastModified: string | null; etag: string | null; fetchedAt: number } | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ content: string; last_modified: string | null; etag: string | null; fetched_at: number }>(
      'SELECT content, last_modified, etag, fetched_at FROM feed_cache WHERE url = ?',
      [url]
    );
    if (!row) return null;
    return {
      content: row.content,
      lastModified: row.last_modified ?? null,
      etag: row.etag ?? null,
      fetchedAt: row.fetched_at,
    };
  }

  async saveFeedCache(url: string, content: string, lastModified: string | null, etag: string | null): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO feed_cache (url, content, last_modified, etag, fetched_at) VALUES (?, ?, ?, ?, ?)',
      [url, content, lastModified, etag, Date.now()]
    );
  }

  async clearFeedCache(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM feed_cache');
  }
}

// ─── Web localStorage fallback ───────────────────────────────────────────────

class WebDatabase implements DatabaseInterface {
  private STORAGE_KEY = 'devjournal_articles';
  private SETTINGS_KEY = 'devjournal_settings';
  private FEEDS_KEY = 'devjournal_feeds';
  private CUSTOM_FEEDS_KEY = 'devjournal_custom_feeds';

  private getArticles(): Article[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  private saveArticlesToStorage(articles: Article[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(articles));
  }

  async saveArticles(articles: ArticleInput[]): Promise<number> {
    const existing = this.getArticles();
    const existingIds = new Set(existing.map(a => a.id));
    let inserted = 0;
    for (const article of articles) {
      if (!existingIds.has(article.id)) {
        existing.push({ ...article, is_bookmarked: false, is_read: false });
        inserted++;
      }
    }
    this.saveArticlesToStorage(existing);
    return inserted;
  }

  async pruneOldArticles(): Promise<number> {
    const articles = this.getArticles();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const before = articles.length;
    const filtered = articles.filter(a => a.pub_date > cutoff);
    this.saveArticlesToStorage(filtered);
    return before - filtered.length;
  }

  async getDigestFeed(limit = 50, offset = 0, sortOrder: 'newest' | 'oldest' = 'newest'): Promise<Article[]> {
    const { names: enabledNames, hasPrefs } = await this.getEnabledSourceNamesWeb();
    if (hasPrefs && enabledNames.length === 0) return [];
    let articles = this.getArticles();
    if (enabledNames.length > 0) {
      const set = new Set(enabledNames);
      articles = articles.filter(a => set.has(a.source_name));
    }
    const dir = sortOrder === 'oldest' ? 1 : -1;
    return articles
      .sort((a, b) => dir * (a.pub_date - b.pub_date))
      .slice(offset, offset + limit);
  }

  private async getEnabledSourceNamesWeb(): Promise<{ names: string[]; hasPrefs: boolean }> {
    const feedsJson = localStorage.getItem(this.FEEDS_KEY);
    if (!feedsJson || feedsJson === '{}') return { names: [], hasPrefs: false };
    const feeds = JSON.parse(feedsJson) as Record<string, boolean>;
    const enabledIds = new Set(Object.entries(feeds).filter(([, v]) => v).map(([k]) => k));
    const { FEED_SOURCES } = await import('@/constants/Feeds');
    const names = FEED_SOURCES.filter(s => enabledIds.has(s.id)).map(s => s.name);
    return { names, hasPrefs: true };
  }

  async getArticlesBySource(sourceName: string, limit = 50): Promise<Article[]> {
    const articles = this.getArticles().filter(a => a.source_name === sourceName);
    const breaking = articles.filter(a => a.importance_score === 5).slice(0, 10);
    const regular = articles
      .filter(a => a.importance_score < 5)
      .sort((a, b) => b.importance_score - a.importance_score || b.pub_date - a.pub_date)
      .slice(0, limit - breaking.length);
    return [...breaking, ...regular];
  }

  async searchArticlesBySource(query: string, sourceName: string, limit = 50): Promise<Article[]> {
    const q = query.toLowerCase();
    return this.getArticles()
      .filter(a => a.source_name === sourceName && (a.title.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q)))
      .slice(0, limit);
  }

  async getEnabledFeedSources(): Promise<FeedSource[]> {
    const { FEED_SOURCES } = await import('@/constants/Feeds');
    const feedsJson = localStorage.getItem(this.FEEDS_KEY);
    
    // No preferences set yet — treat all feeds as available
    if (!feedsJson || feedsJson === '{}') return FEED_SOURCES;

    const feeds = JSON.parse(feedsJson) as Record<string, boolean>;
    return FEED_SOURCES.filter(source => feeds[source.id] === true);
  }

  async getFilteredArticles(filters: FilterState, searchText?: string, limit = 50, offset = 0): Promise<Article[]> {
    let articles = this.getArticles();

    const { names: enabledNames, hasPrefs } = await this.getEnabledSourceNamesWeb();
    if (hasPrefs && enabledNames.length === 0) return [];
    if (enabledNames.length > 0) {
      const set = new Set(enabledNames);
      articles = articles.filter(a => set.has(a.source_name));
    }

    if (searchText?.trim()) {
      const q = searchText.trim().toLowerCase();
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q)
      );
    }

    if (filters.sourceNames.length > 0) {
      const srcSet = new Set(filters.sourceNames);
      articles = articles.filter(a => srcSet.has(a.source_name));
    }

    if (filters.minRating > 1) {
      articles = articles.filter(a => a.importance_score >= filters.minRating);
    }

    if (filters.datePreset) {
      const now = Date.now();
      let cutoff: number;
      switch (filters.datePreset) {
        case '24h': cutoff = now - 86400000; break;
        case '7d': cutoff = now - 604800000; break;
        case '30d': cutoff = now - 2592000000; break;
      }
      articles = articles.filter(a => a.pub_date >= cutoff);
    }

    const dir = filters.sortOrder === 'oldest' ? 1 : -1;
    return articles
      .sort((a, b) => dir * (a.pub_date - b.pub_date))
      .slice(offset, offset + limit);
  }

  async getBookmarks(): Promise<Article[]> {
    return this.getArticles()
      .filter(a => a.is_bookmarked)
      .sort((a, b) => b.pub_date - a.pub_date);
  }

  async getHistory(limit = 100): Promise<Article[]> {
    return this.getArticles()
      .filter(a => a.is_read)
      .sort((a, b) => b.pub_date - a.pub_date)
      .slice(0, limit);
  }

  async searchArticles(query: string, limit = 50): Promise<Article[]> {
    const q = query.toLowerCase();
    return this.getArticles()
      .filter(a => a.title.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q))
      .slice(0, limit);
  }

  async getArticleById(id: string): Promise<Article | null> {
    return this.getArticles().find(a => a.id === id) || null;
  }

  async toggleBookmark(id: string): Promise<boolean> {
    const articles = this.getArticles();
    const idx = articles.findIndex(a => a.id === id);
    if (idx === -1) return false;
    articles[idx].is_bookmarked = !articles[idx].is_bookmarked;
    this.saveArticlesToStorage(articles);
    return articles[idx].is_bookmarked;
  }

  async markRead(id: string): Promise<void> {
    const articles = this.getArticles();
    const idx = articles.findIndex(a => a.id === id);
    if (idx !== -1) { articles[idx].is_read = true; this.saveArticlesToStorage(articles); }
  }

  async markAllRead(): Promise<void> {
    const articles = this.getArticles();
    articles.forEach(a => a.is_read = true);
    this.saveArticlesToStorage(articles);
  }

  async deleteBookmark(id: string): Promise<void> {
    const articles = this.getArticles();
    const idx = articles.findIndex(a => a.id === id);
    if (idx !== -1) { articles[idx].is_bookmarked = false; this.saveArticlesToStorage(articles); }
  }

  async getUnreadCount(): Promise<number> {
    return this.getArticles().filter(a => !a.is_read).length;
  }

  async getArticleCount(): Promise<number> {
    return this.getArticles().length;
  }

  async getStorageStats(): Promise<StorageStats> {
    const articles = this.getArticles();
    const dates = articles.map(a => a.pub_date).filter(Boolean);
    const count = articles.length;
    const storageMb = Math.round((new Blob([localStorage.getItem(this.STORAGE_KEY) || '']).size / (1024 * 1024)) * 10) / 10;
    return { count, oldestDate: dates.length > 0 ? Math.min(...dates) : null, storageMb };
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const settings = JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}');
      return settings[key] ?? defaultValue;
    } catch { return defaultValue; }
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const settings = JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}');
    settings[key] = value;
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
  }

  async setFeedEnabled(id: string, enabled: boolean): Promise<void> {
    const feeds = JSON.parse(localStorage.getItem(this.FEEDS_KEY) || '{}');
    feeds[id] = enabled;
    localStorage.setItem(this.FEEDS_KEY, JSON.stringify(feeds));
  }

  async getEnabledFeeds(): Promise<string[]> {
    const feeds = JSON.parse(localStorage.getItem(this.FEEDS_KEY) || '{}');
    return Object.entries(feeds).filter(([, v]) => v).map(([k]) => k);
  }

  async getDisabledFeeds(): Promise<string[]> {
    const feeds = JSON.parse(localStorage.getItem(this.FEEDS_KEY) || '{}');
    return Object.entries(feeds).filter(([, v]) => !v).map(([k]) => k);
  }

  async addCustomFeed(feed: CustomFeed): Promise<void> {
    const feeds = this.getCustomFeedsSync();
    const idx = feeds.findIndex(f => f.id === feed.id);
    if (idx >= 0) feeds[idx] = feed;
    else feeds.push(feed);
    localStorage.setItem(this.CUSTOM_FEEDS_KEY, JSON.stringify(feeds));
  }

  async removeCustomFeed(id: string): Promise<void> {
    const feeds = this.getCustomFeedsSync().filter(f => f.id !== id);
    localStorage.setItem(this.CUSTOM_FEEDS_KEY, JSON.stringify(feeds));
  }

  async getCustomFeeds(): Promise<CustomFeed[]> {
    return this.getCustomFeedsSync();
  }

  private getCustomFeedsSync(): CustomFeed[] {
    try {
      return JSON.parse(localStorage.getItem(this.CUSTOM_FEEDS_KEY) || '[]');
    } catch { return []; }
  }

  async clearAllData(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  async clearCache(): Promise<void> {
    const articles = this.getArticles().filter(a => a.is_bookmarked);
    this.saveArticlesToStorage(articles);
  }

  async retainOnlyFeeds(keepIds: Set<string>): Promise<void> {
    const customFeeds = this.getCustomFeedsSync().filter(f => keepIds.has(f.id));
    localStorage.setItem(this.CUSTOM_FEEDS_KEY, JSON.stringify(customFeeds));

    const feedsJson = localStorage.getItem(this.FEEDS_KEY);
    if (feedsJson) {
      const feeds = JSON.parse(feedsJson) as Record<string, boolean>;
      for (const id of Object.keys(feeds)) {
        if (!keepIds.has(id)) delete feeds[id];
      }
      localStorage.setItem(this.FEEDS_KEY, JSON.stringify(feeds));
    }

    const keepNames = new Set(customFeeds.map(f => f.name));
    const articles = this.getArticles().filter(a => keepNames.has(a.source_name));
    this.saveArticlesToStorage(articles);
  }

  async getNotifiedArticleIds(): Promise<Set<string>> {
    try {
      const data = localStorage.getItem('devjournal_notified');
      return new Set(data ? JSON.parse(data) : []);
    } catch {
      return new Set();
    }
  }

  async markArticlesNotified(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const existing = await this.getNotifiedArticleIds();
    for (const id of ids) existing.add(id);
    localStorage.setItem('devjournal_notified', JSON.stringify([...existing]));
  }

  async getFeedCache(url: string): Promise<{ content: string; lastModified: string | null; etag: string | null; fetchedAt: number } | null> {
    try {
      const data = localStorage.getItem('devjournal_feed_cache');
      const cache = data ? JSON.parse(data) : {};
      const entry = cache[url];
      if (!entry) return null;
      return {
        content: entry.content,
        lastModified: entry.lastModified ?? null,
        etag: entry.etag ?? null,
        fetchedAt: entry.fetchedAt,
      };
    } catch {
      return null;
    }
  }

  async saveFeedCache(url: string, content: string, lastModified: string | null, etag: string | null): Promise<void> {
    const data = localStorage.getItem('devjournal_feed_cache');
    const cache = data ? JSON.parse(data) : {};
    cache[url] = { content, lastModified, etag, fetchedAt: Date.now() };
    localStorage.setItem('devjournal_feed_cache', JSON.stringify(cache));
  }

  async clearFeedCache(): Promise<void> {
    localStorage.removeItem('devjournal_feed_cache');
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let dbInstance: DatabaseInterface | null = null;

function getDb(): DatabaseInterface {
  if (!dbInstance) {
    if (Platform.OS === 'web') {
      dbInstance = new WebDatabase();
    } else {
      dbInstance = new NativeDatabase();
    }
  }
  return dbInstance;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function saveArticles(articles: ArticleInput[]): Promise<number> {
  return getDb().saveArticles(articles);
}

export function pruneOldArticles(): Promise<number> {
  return getDb().pruneOldArticles();
}

export function getDigestFeed(limit = 50, offset = 0, sortOrder: 'newest' | 'oldest' = 'newest'): Promise<Article[]> {
  return getDb().getDigestFeed(limit, offset, sortOrder);
}

export function getArticlesBySource(sourceName: string, limit = 50): Promise<Article[]> {
  return getDb().getArticlesBySource(sourceName, limit);
}

export function searchArticlesBySource(query: string, sourceName: string, limit = 50): Promise<Article[]> {
  return getDb().searchArticlesBySource(query, sourceName, limit);
}

export function getEnabledFeedSources(): Promise<FeedSource[]> {
  return getDb().getEnabledFeedSources();
}

export function getFilteredArticles(filters: FilterState, searchText?: string, limit = 50, offset = 0): Promise<Article[]> {
  return getDb().getFilteredArticles(filters, searchText, limit, offset);
}

export function getBookmarks(): Promise<Article[]> {
  return getDb().getBookmarks();
}

export function getHistory(limit = 100): Promise<Article[]> {
  return getDb().getHistory(limit);
}

export function searchArticles(query: string, limit = 50): Promise<Article[]> {
  return getDb().searchArticles(query, limit);
}

export function getArticleById(id: string): Promise<Article | null> {
  return getDb().getArticleById(id);
}

export function toggleBookmark(id: string): Promise<boolean> {
  return getDb().toggleBookmark(id);
}

export function markRead(id: string): Promise<void> {
  return getDb().markRead(id);
}

export function markAllRead(): Promise<void> {
  return getDb().markAllRead();
}

export function deleteBookmark(id: string): Promise<void> {
  return getDb().deleteBookmark(id);
}

export function getUnreadCount(): Promise<number> {
  return getDb().getUnreadCount();
}

export function getArticleCount(): Promise<number> {
  return getDb().getArticleCount();
}

export function getStorageStats(): Promise<StorageStats> {
  return getDb().getStorageStats();
}

export function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  return getDb().getSetting(key, defaultValue);
}

export function setSetting<T>(key: string, value: T): Promise<void> {
  return getDb().setSetting(key, value);
}

export function setFeedEnabled(id: string, enabled: boolean): Promise<void> {
  return getDb().setFeedEnabled(id, enabled);
}

export function getEnabledFeeds(): Promise<string[]> {
  return getDb().getEnabledFeeds();
}

export function getDisabledFeeds(): Promise<string[]> {
  return getDb().getDisabledFeeds();
}

export function addCustomFeed(feed: CustomFeed): Promise<void> {
  return getDb().addCustomFeed(feed);
}

export function removeCustomFeed(id: string): Promise<void> {
  return getDb().removeCustomFeed(id);
}

export function getCustomFeeds(): Promise<CustomFeed[]> {
  return getDb().getCustomFeeds();
}

export function clearAllData(): Promise<void> {
  return getDb().clearAllData();
}

export function clearCache(): Promise<void> {
  return getDb().clearCache();
}

export function getNotifiedArticleIds(): Promise<Set<string>> {
  return getDb().getNotifiedArticleIds();
}

export function markArticlesNotified(ids: string[]): Promise<void> {
  return getDb().markArticlesNotified(ids);
}

export function getFeedCache(url: string): Promise<{ content: string; lastModified: string | null; etag: string | null; fetchedAt: number } | null> {
  return getDb().getFeedCache(url);
}

export function saveFeedCache(url: string, content: string, lastModified: string | null, etag: string | null): Promise<void> {
  return getDb().saveFeedCache(url, content, lastModified, etag);
}

export function clearFeedCache(): Promise<void> {
  return getDb().clearFeedCache();
}

export async function seedCustomFeedsIfNeeded(): Promise<void> {
  const { FEED_SOURCES } = await import('@/constants/Feeds');
  const keepIds = new Set(FEED_SOURCES.map(s => s.id));

  const existing = await getCustomFeeds();
  const hasBuiltin = existing.some(f => keepIds.has(f.id));

  if (!hasBuiltin) {
    for (const source of FEED_SOURCES) {
      await addCustomFeed({
        id: source.id,
        name: source.name,
        url: source.url,
        rss_url: source.url,
        icon: source.icon,
        added_at: Date.now(),
      });
      await setFeedEnabled(source.id, true);
    }
  }
}
