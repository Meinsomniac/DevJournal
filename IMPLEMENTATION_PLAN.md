# DevJournal Implementation Plan
## Background Fetch + FTS5 Search

---

## Phase 1: Prerequisites (5 min)

### 1.1 Install Dependencies

```bash
npx expo install expo-background-fetch expo-task-manager
```

Verify in `package.json`:
```json
{
  "expo-background-fetch": "~12.0.1",
  "expo-task-manager": "~12.0.1"
}
```

### 1.2 Add Android Permissions

In `app.json` (or `app.config.js`) add:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.FOREGROUND_SERVICE"
      ]
    },
    "ios": {
      "UIBackgroundModes": ["fetch"]
    }
  }
}
```

> **Note**: Background fetch is iOS-only periodic. Android uses `JobScheduler` under the hood.

---

## Phase 2: FTS5 Database Schema (20 min)

### 2.1 Modify `services/db.ts`

**Add to `initDb()` after existing table creation:**

```typescript
// After: CREATE TABLE IF NOT EXISTS feed_cache (...
// Add this block:

// ─── FTS5 Virtual Table ──────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title,
  summary,
  content='articles',
  content_rowid='rowid'
);

// ─── Triggers to sync articles → articles_fts ────────────────────────
CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, summary)
  VALUES (new.rowid, new.title, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, summary)
  VALUES ('delete', old.rowid, old.title, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, summary)
  VALUES ('delete', old.rowid, old.title, old.summary);
  INSERT INTO articles_fts(rowid, title, summary)
  VALUES (new.rowid, new.title, new.summary);
END;
```

**Also add `ftsMigrated` flag to settings table (first-run detection):**

```typescript
// After existing migration block, add:
const ftsMigrated = await db.getFirstAsync<{ value: string }>(
  "SELECT value FROM settings WHERE key = 'ftsMigrated'"
);
if (!ftsMigrated) {
  // Build index from existing articles
  await db.execAsync(`
    INSERT INTO articles_fts(rowid, title, summary)
    SELECT rowid, title, summary FROM articles;
  `);
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, 'true')",
    ['ftsMigrated']
  );
}
```

---

## Phase 3: Update Search to Use FTS5 (15 minGV)

### 3.1 Modify `services/db.ts` - Replace `searchArticles()`

**NativeDatabase class:**

```typescript
async searchArticles(query: string, limit = 50): Promise<Article[]> {
  const db = await this.getDb();
  const safeQuery = query.replace(/"/g, '').trim();
  
  if (!safeQuery) return this.getDigestFeed(limit);

  // If query is short, use standard LIKE for partial matches
  if (safeQuery.length < 3) {
    const pattern = `%${safeQuery}%`;
    return db.getAllAsync<Article>(
      `SELECT * FROM articles WHERE title LIKE ? OR summary LIKE ?
       ORDER BY pub_date DESC LIMIT ?`,
      [pattern, pattern, limit]
    );
  }

  // FTS5 query with BM25 ranking
  return db.getAllAsync<Article>(
    `SELECT a.* FROM articles a
     JOIN articles_fts fts ON a.rowid = fts.rowid
     WHERE articles_fts MATCH ?
     ORDER BY rank
     LIMIT ?`,
    [safeQuery, limit]
  );
}
```

**WebDatabase class (no change needed - keep existing LIKE search):**

```typescript
async searchArticles(query: string, limit = 50): Promise<Article[]> {
  // Web: no FTS5, use existing LIKE logic
  const q = query.toLowerCase();
  return this.getArticles()
    .filter(a => a.title.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q))
    .slice(0, limit);
}
```

---

## Phase 4: Background Fetch Service (25 min)

### 4.1 Create `services/backgroundFetch.ts`

```typescript
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { fetchAllFeeds } from './rssParser';
import { saveArticles, pruneOldArticles, getNotifiedArticleIds, markArticlesNotified } from './db';
import { deduplicateByLink } from './ranking';
import { sendBreakingNotificationBatch } from './notifications';

const BACKGROUND_FETCH_TASK = 'devjournal-background-fetch';

// ─── Task Definition ────────────────────────────────────────────────────────

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('[BackgroundFetch] Task started');
  
  try {
    const articles = await fetchAllFeeds(true); // skipCache = true
    if (articles.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const unique = deduplicateByLink(articles);
    const savedCount = await saveArticles(unique);
    const prunedCount = await pruneOldArticles();

    console.log(`[BackgroundFetch] Saved ${savedCount}, pruned ${prunedCount}`);

    // Push notifications for breaking news (score = 5)
    const notifiedIds = await getNotifiedArticleIds();
    const breaking = unique.filter(
      a => a.importance_score === 5 && !notifiedIds.has(a.id)
    );

    if (breaking.length > 0) {
      await sendBreakingNotificationBatch(
        breaking.map(a => ({ title: a.title, sourceName: a.source_name, id: a.id }))
      );
      await markArticlesNotified(breaking.map(a => a.id));
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundFetch] Task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Registration ────────────────────────────────────────────────────────────

export async function registerBackgroundFetch(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  if (isRegistered) {
    console.log('[BackgroundFetch] Already registered');
    return;
  }

  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60 * 60 * 4, // 4 hours (minimum allowed by iOS)
      stopOnTerminate: false,       // Continue after user kills app
      startOnBoot: true,            // Resume after device reboot
    });
    console.log('[BackgroundFetch] Registered successfully');
  } catch (error) {
    console.error('[BackgroundFetch] Registration failed:', error);
  }
}

export async function unregisterBackgroundFetch(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('[BackgroundFetch] Unregistered');
  } catch (error) {
    console.error('[BackgroundFetch] Unregistration failed:', error);
  }
}

export function isBackgroundFetchRegistered(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
}
```

### 4.2 Remove Old Foreground Interval from `app/(tabs)/index.tsx`

**Delete this block (lines ~199-213):**

```typescript
// ❌ REMOVE THIS ENTIRE BLOCK
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextState === 'active') {
      fetchNews(true);
    }
    appState.current = nextState;
  });

  const interval = setInterval(() => fetchNews(true), 5 * 60 * 1000);

  return () => {
    subscription.remove();
    clearInterval(interval);
  };
}, [fetchNews]);
```

**Replace with foreground-only refresh:**

```typescript
// ✅ NEW: Only refresh when app comes to foreground
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextState === 'active') {
      fetchNews(true); // Background fetch handles the rest; this is just for immediate UI
    }
    appState.current = nextState;
  });

  return () => subscription.remove();
}, [fetchNews]);
```

---

## Phase 5: Register Background Fetch at App Launch (5 min)

### 5.1 Modify `app/_layout.tsx`

**Add import:**
```typescript
import { registerBackgroundFetch } from '@/services/backgroundFetch';
```

**Add to `useEffect` (line 24-31):**

```typescript
useEffect(() => {
  seedCustomFeedsIfNeeded();
  registerBackgroundFetch(); // ← ADD THIS LINE
  requestNotificationPermissions();
  const subscription = setupNotificationResponseHandler(
    (articleId) => router.push(`/article/${articleId}`)
  );
  return () => subscription.remove();
}, [router]);
```

---

## Phase 6: Testing & Validation (15 min)

### 6.1 Local Testing Commands

```bash
# 1. Ensure everything compiles
npx tsc --noEmit

# 2. Start with cleared database (fresh install simulation)
npx expo start --clear
```

### 6.2 Manual Test Checklist

| Test | Expected Result |
|------|---------------|
| Fresh install → open app | FTS5 table + triggers created, articles_fts populated |
| Search for "React" | Results appear in < 50ms, ranked by relevance |
| Search for "AI release" | Phrase matching returns results containing both words |
| Close app → wait 4+ hours (or use Xcode/lldb to simulate) | Background fetch triggers, new articles appear, push notification for breaking news |
| Reopen app after background fetch | New articles visible without manual refresh |
| Toggle source off | Articles from that source removed from search |

### 6.3 Debug Background Fetch

```bash
# iOS (Simulator - use Xcode instruments or wait for interval)
# Android (ADB):
adb shell cmd jobscheduler run -f com.devjournal 1

# Or use Expo's built-in debug:
npx expo start --android
# Shake → "Debug Remote JS" → watch console for [BackgroundFetch] logs
```

---

## Summary of Changes

| File | Action | Lines |
|------|--------|-------|
| `package.json` | Add `expo-background-fetch`, `expo-task-manager` | Dependencies |
| `app.json` | Add `RECEIVE_BOOT_COMPLETED` permission | Permissions |
| `services/db.ts` | Add FTS5 virtual table + triggers + migration | `initDb()` |
| `services/db.ts` | Replace `searchArticles` with FTS5 + LIKE fallback | Method |
| `services/backgroundFetch.ts` | **Create new file** | Entire file |
| `app/(tabs)/index.tsx` | Remove 5-minute `setInterval` | ~15 lines |
| `app/(tabs)/index.tsx` | Keep only foreground `AppState` listener | `useEffect` |
| `app/_layout.tsx` | Add `registerBackgroundFetch()` import + call | 2 lines |
| `IMPLEMENTATION_PLAN.md` | This file | All |

---

## Key Design Decisions

1. **Dual search strategy**: Short queries (< 3 chars) use `LIKE` for substring matching. Longer queries use FTS5 with BM25 ranking. Best of both worlds.

2. **Database migration on rename**: Changing `devjournal.db` to `devjournal_v2.db` is the cleanest way to apply schema changes without complex migration logic.

3. **Triggers keep FTS in sync**: `INSERT`/`DELETE`/`UPDATE` triggers on `articles` automatically mirror changes to `articles_fts`. No application code changes needed for existing CRUD.

4. **Background fetch replaces frequent foreground polling**: The 5-minute `setInterval` was draining battery and stopping in background. Now one 4-hour background fetch + foreground refresh on app open = fresher data, less battery.
