import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Article, ArticleInput } from '@/types';

interface DatabaseInterface {
  saveArticles(articles: ArticleInput[]): Promise<number>;
  pruneOldArticles(): Promise<number>;
  getDigestFeed(limit?: number): Promise<Article[]>;
  getArticlesByCategory(category: string, limit?: number, offset?: number): Promise<Article[]>;
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
  getStorageStats(): Promise<{ count: number; oldestDate: number | null }>;
  getSetting<T>(key: string, defaultValue: T): Promise<T>;
  setSetting<T>(key: string, value: T): Promise<void>;
  setFeedEnabled(id: string, enabled: boolean): Promise<void>;
  getEnabledFeeds(): Promise<string[]>;
  getDisabledFeeds(): Promise<string[]>;
  clearAllData(): Promise<void>;
  clearCache(): Promise<void>;
}

// ─── Native SQLite implementation ────────────────────────────────────────────

class NativeDatabase implements DatabaseInterface {
  private dbPromise: Promise<SQLite.SQLiteDatabase>;

  constructor() {
    this.dbPromise = this.initDb();
  }

  private async initDb(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync('techpulse.db');
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
        category TEXT NOT NULL,
        is_bookmarked INTEGER NOT NULL DEFAULT 0,
        is_read INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date);
      CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
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
    `);
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
            `INSERT INTO articles (id, title, link, source_name, source_icon_uri, pub_date, fetched_at, summary, image_uri, importance_score, category, is_bookmarked, is_read)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [a.id, a.title, a.link, a.source_name, a.source_icon_uri ?? null, a.pub_date, a.fetched_at, a.summary, a.image_uri ?? null, a.importance_score, a.category]
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

  async getDigestFeed(limit = 50): Promise<Article[]> {
    const db = await this.getDb();
    const breaking = await db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE importance_score = 5 ORDER BY pub_date DESC LIMIT 10`
    );
    const remaining = limit - breaking.length;
    const regular = await db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE importance_score < 5 ORDER BY importance_score DESC, pub_date DESC LIMIT ?`,
      [remaining]
    );
    return [...breaking, ...regular];
  }

  async getArticlesByCategory(category: string, limit = 50, offset = 0): Promise<Article[]> {
    const db = await this.getDb();
    return db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE category = ? ORDER BY pub_date DESC LIMIT ? OFFSET ?`,
      [category, limit, offset]
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

  async getStorageStats(): Promise<{ count: number; oldestDate: number | null }> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number; oldestDate: number | null }>(
      'SELECT COUNT(*) as count, MIN(pub_date) as oldestDate FROM articles'
    );
    return { count: row?.count ?? 0, oldestDate: row?.oldestDate ?? null };
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

  async clearAllData(): Promise<void> {
    const db = await this.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM articles');
      await db.runAsync('DELETE FROM settings');
      await db.runAsync('DELETE FROM feed_preferences');
    });
  }

  async clearCache(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM articles WHERE is_bookmarked = 0');
  }
}

// ─── Web localStorage fallback ───────────────────────────────────────────────

class WebDatabase implements DatabaseInterface {
  private STORAGE_KEY = 'techpulse_articles';
  private SETTINGS_KEY = 'techpulse_settings';
  private FEEDS_KEY = 'techpulse_feeds';

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

  async getDigestFeed(limit = 50): Promise<Article[]> {
    const articles = this.getArticles();
    const breaking = articles.filter(a => a.importance_score === 5).slice(0, 10);
    const regular = articles.filter(a => a.importance_score < 5)
      .sort((a, b) => b.importance_score - a.importance_score || b.pub_date - a.pub_date)
      .slice(0, limit - breaking.length);
    return [...breaking, ...regular];
  }

  async getArticlesByCategory(category: string, limit = 50, offset = 0): Promise<Article[]> {
    return this.getArticles()
      .filter(a => a.category === category)
      .sort((a, b) => b.pub_date - a.pub_date)
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

  async getStorageStats(): Promise<{ count: number; oldestDate: number | null }> {
    const articles = this.getArticles();
    const dates = articles.map(a => a.pub_date).filter(Boolean);
    return { count: articles.length, oldestDate: dates.length > 0 ? Math.min(...dates) : null };
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

  async clearAllData(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.SETTINGS_KEY);
  }

  async clearCache(): Promise<void> {
    const articles = this.getArticles().filter(a => a.is_bookmarked);
    this.saveArticlesToStorage(articles);
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

export function getDigestFeed(limit = 50): Promise<Article[]> {
  return getDb().getDigestFeed(limit);
}

export function getArticlesByCategory(category: string, limit = 50, offset = 0): Promise<Article[]> {
  return getDb().getArticlesByCategory(category, limit, offset);
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

export function getStorageStats(): Promise<{ count: number; oldestDate: number | null }> {
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

export function clearAllData(): Promise<void> {
  return getDb().clearAllData();
}

export function clearCache(): Promise<void> {
  return getDb().clearCache();
}
