# 📦 **TECH PULSE — AI BUILDER PACK: MONETIZATION & PRODUCT FLOW**
*Append this to the previous Technical Specification. This document is optimized for LLM context windows (structured, declarative, copy-paste ready).*

---

## 💰 **PART 1: MONETIZATION STRATEGY (HALAL-COMPLIANT, ZERO-COST)**

### **1.1 Revenue Stack Priority Matrix**

| Priority | Method | Implementation Location | Halal Safeguard | Effort | Est. RPM (Revenue Per Mille Impressions) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0** | **Native Advanced Ads (In-Feed)** | `Digest Tab` (Every 8th item), `Feeds Tab` (Between groups), `Search Results` (Position 3) | AdMob Blocking Controls + Manual Review | Low (Config + 1 Component) | **$2.00 – $5.00** (Dev niche) |
| **P0** | **Banner Ad (Anchored Bottom)** | `Digest Tab`, `Feeds Tab`, `Saved Tab`, `Search Tab` (Persistent) | Same as above | Low (1 Component) | **$0.50 – $1.50** |
| **P1** | **Rewarded Interstitial (Optional Premium)** | `Settings > "Unlock Compact Density"` or "Unlock 30-Day Archive" | User *chooses* to watch. No gambling/casino ads. | Medium (Entitlement Logic) | **$5.00 – $15.00** per 1k views |
| **P2** | **Affiliate Links (Curated)** | `Article Screen` (Bottom: "Tools Mentioned"), `Digest Card` (Tag: "🔧 Tool") | Only Halal products (Hosting, IDEs, Courses, Books). `rel="sponsored nofollow"`. | Manual Curation | **Variable (High Intent)** |
| **P3** | **Freemium IAP (Remove Ads)** | `Settings > "Support Development"` | One-time purchase (Non-consumable). No subscription pressure. | Medium (RevenueCat/StoreKit) | **$1.99 – $4.99** / user |

> **🚫 EXPLICITLY FORBIDDEN (Haram Risk):**
> *   Interstitial Ads on App Launch / Exit (Disruptive/UX harm).
> *   Ads for: Crypto Exchanges, Gambling, Alcohol, Dating, "Get Rich Quick" schemes, Ribaa-based Fintech.
> *   Selling User Data / Email lists.
> *   "Native" ads mimicking content without "Sponsored" label (Deception/Gharar).

---

### **1.2 AdMob Configuration Checklist (Pre-Launch Mandatory)**
*Copy-paste into your `ADMOB_SETUP.md` for the AI builder.*

```markdown
## ADMOB CONSOLE CONFIGURATION (Blocking Controls)

### 1. SENSITIVE CATEGORIES -> BLOCK ALL
- [ ] Alcohol
- [ ] Gambling & Games (Real Money)
- [ ] Dating
- [ ] Religion (Block non-Islamic proselytizing)
- [ ] Politics
- [ ] Weight Loss / Cosmetic Procedures
- [ ] **Cryptocurrency & Blockchain** (Critical for Dev Apps)
- [ ] Financial Products (High Risk/Ribaa) -> *Allow only "Software/Tools" sub-cats if granular*

### 2. GENERAL CATEGORIES -> ALLOW ONLY
- [x] Computer Hardware / Software
- [x] Internet & Telecom
- [x] Business & Industrial (B2B SaaS)
- [x] Education & Careers (Bootcamps, Certs)
- [x] Technology News / Developer Tools

### 3. ADVERTISER URL BLOCK LIST (Manual Entry)
# Add these immediately via Ad Review Center -> "Block Advertiser"
binance.com, coinbase.com, bybit.com, kraken.com, crypto.com, okx.com, kucoin.com, 
metamask.io, trustwallet.com, phantom.app, uniswap.org, pancakeswap.finance, opensea.io,
blaze.com, stake.com, roobet.com, 1xbet.com, bet365.com,
onlyfans.com, patreon.com (Adult content risk), 
upwork.com/freelancer.com (Low quality "hire me" ads - optional block)

### 4. AD REVIEW CENTER
- [ ] Set to "Review All Ads" for first 30 days.
- [ ] Weekly 15-min audit: Block any "Earn $X coding", "AI Trading Bot", "Cloud Mining".

### 5. CONSENT (UMP SDK - MANDATORY FOR PLAY STORE)
- [ ] Configure GDPR (EU), CCPA (CA), LGPD (BR) messages.
- [ ] **Tag for Under Age of Consent (TFUA):** `false` (Dev audience 18+).
- [ ] **Tag for Child-Directed Treatment (TFCD):** `false`.
```

---

### **1.3 Ad Unit ID Map (For AI Builder)**
*Replace `ca-app-pub-XXXXXXXX/YYYYYYYY` with your Production IDs post-approval.*

| Ad Slot ID (Code Constant) | Format | Placement | Refresh Rate | Targeting |
| :--- | :--- | :--- | :--- | :--- |
| `AD_DIGEST_NATIVE` | **Native Advanced (Medium Rectangle 300x250)** | Digest List: Index 7, 15, 23... (Every 8) | No Refresh (Static) | High Context (Article Content) |
| `AD_FEEDS_NATIVE` | **Native Advanced** | Feeds List: Between Category Groups | No Refresh | Source Context |
| `AD_SEARCH_NATIVE` | **Native Advanced** | Search Results: Index 3 | No Refresh | Query Intent |
| `AD_GLOBAL_BANNER` | **Adaptive Banner (Bottom Anchored)** | All Tabs (Except Article Detail, Settings) | 60s (Auto) | General App Context |
| `AD_REWARDED_UNLOCK` | **Rewarded Interstitial** | Settings: "Unlock Compact Mode" / "Extend Archive to 30 Days" | User Triggered | Opt-in Only |

---

### **1.4 Native Ad Template Spec (For `components/ads/NativeAd.tsx`)**
*Use **Template: "Medium Rectangle"** in AdMob Console. Map these keys exactly.*

```typescript
// Native Ad Field Mapping (Must match AdMob Template Setup)
interface NativeAdAssets {
  headline: string;           // "Headline" (Required)
  body: string;               // "Body" (Required)
  callToAction: string;       // "Call to Action" (Button Text)
  advertiser: string;         // "Advertiser" (Small text)
  icon: { uri: string };      // "Icon" (Small square)
  mainImage?: { uri: string }; // "Image" (Large landscape - Optional)
  mediaContent: any;          // Video/Media View (Auto)
  // Custom Styling (Enforced in RN Component)
  style: {
    container: { backgroundColor: 'bgCard', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'borderLight' },
    headlineColor: 'textPrimary',
    bodyColor: 'textSecondary',
    ctaBackgroundColor: 'brandPrimary',
    ctaTextColor: 'textInverse',
    disclosureText: 'Sponsored', // Hardcoded "Sponsored" label (Top Right)
    disclosureColor: 'textTertiary',
  }
}
```

---

## 🔄 **PART 2: PRODUCT FLOW & USER JOURNEYS (FOR AI CODE GEN)**

### **2.1 Core Data Flow Diagram (Text-Based for LLM)**

```mermaid
graph TD
    A[App Cold Start] --> B{DB Exists?}
    B -- No --> C[Run Migrations\nCreate Schema\nSeed Feeds Config]
    B -- Yes --> D[Read Preferences\nMinScore, EnabledSources]
    C --> D
    D --> E[Query DB: getDigestFeed(50)]
    E --> F[Render Digest Tab\nFlashList + NativeAds]
    
    G[Background Fetch Trigger\n(OS / 4hrs)] --> H[FetchAllFeeds Parallel]
    H --> I[Parse XML -> JSON\nNormalize Dates/Links]
    I --> J[Deduplicate by Link Hash]
    J --> K[Score & Categorize\n(Client-Side Logic)]
    K --> L[Filter by User Prefs]
    L --> M[Insert SQLite Transaction]
    M --> N[Prune > 7 Days]
    N --> O[Update Badge Count]
    O --> P{Breaking News?\nScore 5}
    P -- Yes --> Q[Schedule Local Notif]
    P -- No --> R[Silent Update]
    
    F --> S[User Scrolls]
    S --> T{Sees Native Ad}
    T -- Impression --> U[AdMob Pays]
    T -- Click --> V[External Browser]
    
    S --> W[Tap Article Card]
    W --> X[Push /article/:id]
    X --> Y[Mark Read in DB\nUpdate FTS]
    Y --> Z[Render WebView\nSanitized HTML]
    Z --> AA[Bottom Bar: Bookmark/Share/Open]
    
    AA --> AB[User Bookmarks]
    AB --> AC[DB Update is_bookmarked=1]
    AC --> AD[Saved Tab Updates Instantly]
```

---

### **2.2 Screen-to-Screen Navigation Flow (Router Tree)**

```
app/
├── _layout.tsx                 // Root: Providers (Theme, DB, AdMob, Notifications)
│
├── (auth)/                     // (Future) Optional Onboarding
│
├── (tabs)/                     // BOTTOM TABS (HIDDEN on Article/Settings)
│   ├── _layout.tsx             // Tab Navigator Config (Icons, Labels, Badge)
│   ├── index.tsx               // 🏠 DIGEST (Default Route)
│   ├── feeds.tsx               // 📂 SOURCES
│   ├── saved.tsx               // ⭐ SAVED (Bookmarks + History Segments)
│   └── search.tsx              // 🔍 SEARCH (Focus Input on Mount)
│
├── article/
│   └── [id].tsx                // 📖 ARTICLE DETAIL (WebView) -- HIDES TABS
│
├── settings.tsx                // ⚙️ SETTINGS (Modal/Full Screen) -- HIDES TABS
│
└── +not-found.tsx              // 404 Fallback
```

**Navigation Rules for AI:**
1.  **Tabs persist** only on `(tabs)/*` routes.
2.  **Article Screen** (`/article/:id`) **hides Tab Bar** (`headerShown: false` in stack, `tabBarHidden: true`).
3.  **Settings** accessible via Header Right Button (Digest) OR Deep Link `/settings`.
4.  **Deep Link Handling:** `techpulse://article/<sha256_id>` -> Opens Article Screen directly.
5.  **Notification Tap:** Payload `{ screen: 'article', id: '...' }` -> Navigate to Article.

---

### **2.3 User Journey Scenarios (Happy Paths)**

#### **Journey A: "The Morning Commuter" (Primary Persona)**
1.  **Trigger:** Push Notification "🔥 Breaking: React Native 0.76 Released" (Score 5).
2.  **Action:** Tap Notification -> App Opens -> **Article Screen** (WebView loads instantly from cache/DB).
3.  **Engagement:** Reads 60-sec summary (extracted from RSS). Taps **"🔗 Source"** -> Opens SafariViewController (GitHub Blog).
4.  **Retention:** Returns to App -> **Digest Tab** shows "React Native" card at Top (Breaking Section).
5.  **Monetization:** Scrolls past 7 items -> Sees **Native Ad (Vercel)**. High relevance -> Click -> Revenue.
6.  **Habit:** Taps **Bookmark** (Star fills yellow). Goes to **Saved Tab** -> Sees it under "Bookmarks".

#### **Journey B: "The Deep Dive Researcher"**
1.  **Entry:** Opens App -> **Search Tab** (Keyboard auto-focus).
2.  **Query:** Types "kubernetes sidecar".
3.  **Result:** **FTS5 Instant Results** (< 100ms). Highlights match in snippet.
4.  **Filter:** Taps Chip **[☸️ Infra]** -> Filters results client-side.
5.  **Read:** Opens 3 articles sequentially. Each **Marked Read** (Grey dot disappears).
6.  **Save:** Bookmarks 1 "Kubernetes 1.29 Sidecar" article.
7.  **Exit:** Closes App. Data persisted locally. Zero server cost.

#### **Journey C: "The Source Curator" (Power User)"
1.  **Entry:** **Feeds Tab**.
2.  **Action:** Sees "VentureBeat AI" is OFF. Toggles **ON**.
3.  **Feedback:** Toast "Fetching latest from VentureBeat..." -> Background fetch triggers immediately (or next cycle).
4.  **Customization:** Long presses "The Verge" -> "Edit Keywords" -> Adds "AI", Blocks "Phone Review".
5.  **Result:** Next Digest shows only AI articles from The Verge. Noise reduced.

---

### **2.4 State Management Map (For AI State Architecture)**

| State Domain | Storage | Scope | Sync Strategy | Key Hooks |
| :--- | :--- | :--- | :--- | :--- |
| **Articles (Core)** | `op-sqlite` (File) | Global | **Single Source of Truth**. UI reacts via `useArticles` hook polling or `useEffect` on focus. | `useDigestFeed()`, `useCategoryFeed(cat)`, `useBookmarks()`, `useSearch(query)` |
| **User Preferences** | `AsyncStorage` (MMKV preferred) | Global | Load on Boot -> Context Provider. Write-through on change. | `usePreferences()` -> `{ minScore, enabledSources, blockedKeywords, theme, fontSize }` |
| **UI State (Transient)** | React State / Context | Screen | Ephemeral. `isLoading`, `searchQuery`, `selectedCategory`, `scrollPosition`. | `useState`, `useRef` |
| **Ad State** | AdMob SDK Internal | Global | `AdProvider` Context. `isAdLoaded`, `adError`. | `useAd(adUnitId)` |
| **Notification State** | OS + `expo-notifications` | Global | Permissions -> Token -> Local Schedule. | `useNotifications()` |
| **Background Sync** | `expo-background-fetch` | Daemon | Headless JS Task. Writes to SQLite. Posts `ArticlesUpdated` Event. | `EventEmitter` / `useFocusEffect` Re-fetch |

---

### **2.5 Component Prop Contracts (TypeScript Interfaces for AI)**

```typescript
// types/components.ts - PASTE THIS INTO AI CONTEXT

// --- DIGEST TAB ---
export interface DigestCardProps {
  article: Article;           // Full Article Type (see db.ts)
  variant: 'feature' | 'compact'; // Feature = First 2 (Score 5), Compact = Rest
  onPress: (id: string) => void;
  onBookmark: (id: string, current: boolean) => void;
  index: number;              // For Native Ad Injection Logic (Parent handles)
}

export interface SectionHeaderProps {
  title: string;              // "🔥 BREAKING", "⚛️ FRONTEND"
  count: number;
  categoryKey?: string;       // For Filter Navigation
}

// --- FEEDS TAB ---
export interface SourceRowProps {
  source: FeedSource & { 
    articleCount: number; 
    lastFetched: number; 
    isEnabled: boolean;
  };
  onToggle: (name: string, enabled: boolean) => void;
  onPress: (name: string) => void; // Navigate to filtered list
}

export interface CategoryGroupProps {
  category: CategoryConfig;   // { key: 'ai', label: 'AI & ML', emoji: '🤖', color: 'catAI' }
  sources: SourceRowProps['source'][];
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// --- SAVED TAB ---
export interface BookmarkCardProps {
  article: Article;
  onPress: (id: string) => void;
  onRemoveBookmark: (id: string) => void; // Swipe Action
  onShare: (article: Article) => void;
}

export interface HistorySectionProps {
  dateLabel: string;          // "TODAY", "YESTERDAY", "JAN 14"
  articles: Article[];
  onPress: (id: string) => void;
}

// --- SEARCH TAB ---
export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (query: string) => void;
  placeholder: string;
  autoFocus: boolean;
  recentSearches: string[];
  onClearRecent: () => void;
}

export interface FilterChipProps {
  label: string;
  key: string;
  isSelected: boolean;
  onPress: (key: string) => void;
  count?: number; // Optional badge
}

// --- ARTICLE DETAIL ---
export interface ArticleWebViewProps {
  html: string;               // Sanitized HTML String
  article: Article;
  onLinkPress: (url: string) => void; // Open in Browser
  onLoadEnd: () => void;      // Hide Skeleton
}

export interface ActionBarProps {
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
  onOpenBrowser: () => void;
  onShare: () => void;
  onMore: () => void;         // Action Sheet
}

// --- ADS ---
export interface BannerAdProps {
  unitId: string;             // AD_GLOBAL_BANNER
  size: 'ANCHORED_ADAPTIVE_BANNER';
  testDeviceIds?: string[];
}

export interface NativeAdProps {
  unitId: string;             // AD_DIGEST_NATIVE, etc.
  templateType: 'medium_rectangle';
  styleOverrides?: NativeAdAssets['style'];
  onAdLoaded: () => void;
  onAdFailed: (error: string) => void;
}
```

---

### **2.6 Critical "AI Builder" Instructions (System Prompt Addendum)**

> **INSTRUCTIONS FOR THE CODING AGENT:**
> 1.  **NO BACKEND CODE.** Do not generate Express, Next.js API routes, Firebase Functions, Python scripts, or GitHub Actions workflows. The app is **100% Client-Side**.
> 2.  **DATABASE IS `op-sqlite`.** Use synchronous API (`execSync`, `prepareSync`, `getAllSync`). Do not use `expo-sqlite` (async) or WatermelonDB.
> 3.  **NAVIGATION IS EXPO ROUTER v3.** File-based routing. Use `router.push('/article/' + id)`. Tabs defined in `app/(tabs)/_layout.tsx`.
> 4.  **LISTS ARE `@shopify/flash-list`.** Do not use `FlatList`. Use `FlashList` with `estimatedItemSize` and `keyExtractor={item => item.id}`.
> 5.  **STYLING IS "STYLE OBJECTS" + CONSTANTS.** No Tailwind/NativeWind/Styled Components. Use `constants/Colors.ts`, `Typography.ts`, `Spacing.ts`. Dark mode via `useColorScheme` hook + Context.
> 6.  **RSS PARSING IS `fast-xml-parser`.** Handle RSS 2.0, Atom 1.0, JSON Feed variances in `rssParser.ts`. No external API keys.
> 7.  **BACKGROUND FETCH IS `expo-background-fetch` + `expo-task-manager`.** Define task in `app/backgroundFetch.ts`. Register in `app/_layout.tsx` `useEffect`.
> 8.  **ADMOB IS `react-native-google-mobile-ads`.** Initialize in `app/_layout.tsx`. Request Consent (UMP) before loading ads. Use **Test IDs** during dev.
> 9.  **WEBVIEW FOR ARTICLES.** Use `react-native-webview`. Inject JS to strip paywalls/cookie banners. `originWhitelist={['*']}`.
> 10. **TYPESCRIPT STRICT MODE.** No `any`. Define all types in `types/index.ts`.
> 11. **HALAL COMPLIANCE.** Hardcode "Sponsored" label on Native Ads. No gambling/crypto ad logic in code (handled in AdMob Console), but ensure `AdRequest` config has `tagForChildDirectedTreatment: false`, `tagForUnderAgeOfConsent: false`.
> 12. **ERROR BOUNDARIES.** Wrap each Tab Screen and Article Screen in `ErrorBoundary` (expo-error-recovery or custom).
> 13. **PERFORMANCE.** `React.memo` on all List Items (`DigestCard`, `SourceRow`). `useCallback` for handlers. `FlashList` `renderItem` must be stable.

---

## 📋 **PART 3: ACCEPTANCE CRITERIA (Definition of Done for MVP)**

### **Functional**
- [ ] App launches -> Shows Digest Tab with cached news (Offline First).
- [ ] Pull-to-Refresh triggers immediate Background Fetch logic (Foreground).
- [ ] Background Fetch runs automatically (min 4hr interval) -> New articles appear + Badge updates.
- [ ] Articles older than 7 days **deleted** on next fetch/app start.
- [ ] Search returns results in < 200ms (FTS5) with highlighted snippets.
- [ ] Bookmark toggles persist across app restarts.
- [ ] Feeds Tab toggles instantly filter Digest/Search results.
- [ ] Article Screen loads WebView -> Sanitized (No cookie banners, no paywall overlays).
- [ ] Share Sheet opens with Title + URL.
- [ ] Settings: Theme toggle persists, Font Size applies globally, Min Importance filters Digest.

### **Monetization**
- [ ] Banner Ad visible on all Tabs (Not Article/Settings).
- [ ] Native Ad renders every 8 items in Digest/Feeds/Search (Correct Template Mapping).
- [ ] AdMob Consent Form shows on First Launch (EU/UK/CA).
- [ ] Zero AdMob Policy Violations in Test Suite (Test IDs).

### **Non-Functional**
- [ ] Cold Start < 2s (Low-end Android).
- [ ] Scroll 60fps (FlashList + `removeClippedSubviews`).
- [ ] APK Size < 35MB (Expo Managed).
- [ ] Crash-Free Sessions > 99.5% (Sentry/Play Console).
- [ ] Zero Network Requests on Article Open (WebView uses cached HTML/Images if possible, but primarily loads Source URL).

---

## 🚀 **PART 4: LAUNCH SEQUENCE (AI-Actionable Checklist)**

```bash
# 1. FINAL BUILD
eas build --platform android --profile production --auto-submit=false
# Output: techpulse-v1.0.0.aab

# 2. PLAY STORE INTERNAL TESTING
# Upload AAB -> Create Release -> Add Testers (Your Email)
# Test: Background Fetch, Notifications, AdMob Test Ads, Deep Links.

# 3. ADMOB PRODUCTION SWITCH
# .env.production:
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-REAL_ID~REAL_ID
EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-REAL_ID~REAL_ID
# Update Ad Unit IDs in constants/Ads.ts

# 4. REBUILD WITH PROD IDS
eas build --platform android --profile production

# 5. PLAY STORE PRODUCTION ROLLOUT
# 10% -> 50% -> 100% over 7 days.
# Monitor: ANR Rate, Crash Rate, Ad Impression RPM, Retention Day 1/7.

# 6. MARKETING LOOP (Manual - You)
# Daily: Post Digest Screenshot on X/LinkedIn.
# Weekly: Blog Post "Top 5 Dev Tools This Week" -> Link to App.
# Monthly: Update FEED_SOURCES.ts via OTA (eas update --branch production).
```

---

## 📁 **FILE MANIFEST FOR AI CONTEXT WINDOW**
*Feed these files in order to the AI (Cursor Composer, Claude Project, GPT-4o Code Interpreter).*

1.  `SPEC_MONETIZATION_FLOW.md` **(This File)**
2.  `SPEC_TECH_ARCH_UI.md` **(Previous Response)**
3.  `constants/Feeds.ts` **(Your Curated 15 RSS URLs)**
4.  `constants/Keywords.ts` **(Scoring & Category Keywords)**
5.  `types/index.ts` **(All TypeScript Interfaces)**
6.  `services/db.ts` **(SQLite Schema & Queries)**
7.  `services/rssParser.ts` **(Fetch & Parse Logic)**
8.  `services/ranking.ts` **(Scoring Algorithm)**
9.  `services/backgroundFetch.ts` **(Headless Task)**
10. `app/_layout.tsx` **(Providers, Fonts, AdMob Init, BG Task Reg)**
11. `app/(tabs)/_layout.tsx` **(Tab Config, Badge Logic)**
12. `app/(tabs)/index.tsx` **(Digest Screen + FlashList + Ad Injection)**
13. `components/digest/DigestCard.tsx` **(Feature/Compact Variants)**
14. `components/ads/NativeAd.tsx` **(Template Mapping + "Sponsored" Label)**
15. `components/ads/BannerAd.tsx` **(Anchored Bottom)**
16. `app/article/[id].tsx` **(WebView + Sanitization + Action Bar)**
17. `app/settings.tsx` **(Preferences UI + MMKV Sync)**

---

**You now have a complete, unambiguous specification set.** Feed **Part 1 (Monetization)**, **Part 2 (Flow/Contracts)**, and the **Previous Tech Spec** into your AI builder. It has everything needed to generate a production-ready, Halal-compliant, zero-backend React Native news app.