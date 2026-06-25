# DevJournal — Version 2 Roadmap

Features and improvements planned for the next release.

---

## Settings & Preferences

- [ ] **Font size setting** — `small | medium | large` toggle in Settings screen. Type `fontSize` already exists in `types/index.ts`.
- [ ] **Daily / Weekly digest notifications** — Toggle in Settings screen for scheduled notification digests. Types `notifyDaily`/`notifyWeekly` already defined in `types/index.ts`.
- [ ] **Blocked keywords** — UI in Settings or Feeds screen to block articles containing specific keywords. Type `blockedKeywords` already defined in `types/index.ts`.
- [ ] **Minimum importance filter** — Slider or picker to hide articles below a certain importance score. Type `minImportance` already defined in `types/index.ts`.

---

## UX Polish

- [ ] **Skeleton-to-content crossfade** — Skeletons should fade out as content fades in, rather than disappearing instantly (`components/ui/Skeleton.tsx` → `app/(tabs)/index.tsx`).
- [ ] **List item entrance stagger** — Articles should stagger in (e.g. 50ms interval) on first load instead of appearing in a single batch fade (`app/(tabs)/index.tsx`).
- [ ] **Theme transition smoothing** — Animate color changes when switching between light/dark mode.
- [ ] **Tab bar haptic feedback** — Light haptic when switching tabs.
- [ ] **`useApiFeedback` hook** — Reusable wrapper for API calls with built-in toast + haptics (as suggested in `UX_ENHANCEMENT_GUIDE.md`).

---

## New Features

- [ ] **Article history** — Show recently read articles in the Saved screen or a dedicated tab. DB method `getHistory()` already exists in `services/db.ts`.
- [ ] **Swipe-to-delete on saved articles** — Swipe gesture to remove bookmarks from the Saved screen.
- [ ] **Notification Bell** — Wire up the `showNotifications` prop in `Header.tsx` to display and handle notification events.
- [ ] **OS-level background fetch** — Use `expo-background-fetch` + `expo-task-manager` for true background article fetching (currently only foreground polling via `setInterval`).

---

## Content & Discovery

- [ ] **Feed discovery backend** — Standalone Node.js/Express/Puppeteer service to replace client-side scraping (`services/feedDiscovery.ts` → `feed-discovery-service/`). Full spec in `feed_discovery.md`.
- [ ] **Article categorization** — Tag articles by topic (AI, React, Rust, Kubernetes, etc.) for filtering and discovery. Keyword data in `constants/Keywords.ts`.

---

## Dead Code Cleanup

- [ ] **Privacy Policy / Terms of Service buttons** — Wire up to open external URLs when pages are published.
- [ ] **Notification Bell dead prop** — Either implement or remove `showNotifications` / `onNotificationPress` from `Header.tsx`.
- [ ] **`eslint-disable` comments** — Resolve the 10 suppressed warnings across 4 files (`app/(tabs)/index.tsx`, `app/article/[id].tsx`, `components/feeds/AddFeedModal.tsx`).

---

## Monetization (post-v2)

- [ ] **AdMob Native Advanced Ads** — Every 8th item in Digest/Feeds lists.
- [ ] **Adaptive Banner** — Bottom-anchored banner on all tabs.
- [ ] **Rewarded Interstitial** — "Unlock Compact Mode" reward.
- [ ] **IAP — Remove Ads** — One-time purchase.
- [ ] **IAP — Compact Mode** — One-time purchase (if not unlocked via rewarded ad).
