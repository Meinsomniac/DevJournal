# RSS Feed Discovery Service — Implementation Plan

## 1. Overview

Build a lightweight, dedicated **backend discovery service** that accepts any website URL, uses a headless browser to fetch the page, extracts all RSS/Atom feed links, and returns a clean JSON response.

This service will be consumed by the React Native app via a single API endpoint, solving all current client-side discovery issues (CORS, Cloudflare, JS-rendered sites, Medium, etc.).

---

## 2. Goals & Non-Goals

### Goals
- Single API endpoint: `POST /discover` (or `GET /discover?url=...`)
- Reliable feed discovery for JS-rendered and bot-protected sites (Medium, Substack, etc.)
- Fast response via caching
- Deployable on free tiers (Render, Railway, Fly.io, Vercel Serverless Functions)

### Non-Goals
- Not a full-blown RSS parser/reader (just discovers feeds)
- Not a persistent database (ephemeral cache only)

---

## 3. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Runtime | Node.js 18+ | Familiar, fast, great async support |
| Framework | Express.js or Fastify | Lightweight HTTP server |
| Headless Browser | Puppeteer (with `puppeteer-core` + `chrome-aws-lambda` if serverless) | Handles JS-rendered pages, bypasses simple bot checks |
| Caching | node-cache or Redis (if available) | Avoid re-scraping same URLs repeatedly |
| Hosting | Render / Fly.io / Railway / Vercel (serverless) | Free tier friendly, easy deploy |

---

## 4. API Specification

### Endpoint
```
POST /discover
Content-Type: application/json
```

### Request Body
```json
{
  "url": "https://medium.com"
}
```

### Response Body
```json
{
  "success": true,
  "sourceUrl": "https://medium.com",
  "feeds": [
    {
      "name": "Medium Staff — Medium",
      "rssUrl": "https://medium.com/feed/@MediumStaff",
      "url": "https://medium.com",
      "favicon": "https://www.google.com/s2/favicons?domain=medium.com&sz=64",
      "category": "General"
    }
  ]
}
```

### Error Response
```json
{
  "success": false,
  "sourceUrl": "https://medium.com",
"error": "Failed to discover feeds",
  "feeds": []
}
```

---

## 5. Service Architecture

```
┌─────────────────────────────┐
│      React Native App        │
│  calls POST /discover        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Discovery Service (Node)  │
│  - Express/Fastify server   │
│  - node-cache (in-memory)   │
│  - Puppeteer headless       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│    Target Website           │
│  (Medium, Substack, etc.)   │
└─────────────────────────────┘
```

---

## 6. Implementation Steps

### Step 1: Bootstrap Project
```bash
mkdir feed-discovery-service && cd feed-discovery-service
npm init -y
npm install express puppeteer node-cache
npm install -D typescript ts-node @types/express @types/node
npx tsc --init
```

### Step 2: Core Discovery Logic (`src/discover.ts`)
- Launch Puppeteer browser (or reuse existing instance for speed)
- Navigate to target URL with realistic headers
- Wait for network idle or DOM ready
- Extract all `<link rel="alternate" type="...">` tags
- Fallback: try common feed paths (`/feed`, `/rss.xml`, `/atom.xml`, etc.)
- Close page (but keep browser instance alive for reuse)

### Step 3: Express Server (`src/server.ts`)
- `POST /discover` endpoint
- Validate input URL
- Check cache first
- Call `discoverFeeds(url)`
- Cache result for 1 hour
- Return JSON

### Step 4: Caching Layer
- Use `node-cache` with TTL=3600s (1 hour)
- Key: normalized URL
- Keeps memory low, avoids re-scraping

### Step 5: Deployment
- **Render**: Docker-based, free tier, auto-sleep after 15 min (cold start acceptable)
- **Fly.io**: Docker-based, free tier, stays awake
- **Railway**: Easy deploy, free tier has usage limits
- **Vercel Serverless**: Use `chrome-aws-lambda` + `puppeteer-core` for Puppeteer in serverless functions

---

## 7. File Structure

```
feed-discovery-service/
├── src/
│   ├── server.ts          # Express entry point
│   ├── discover.ts        # Core scraping logic
│   ├── cache.ts           # node-cache wrapper
│   └── types.ts           # TypeScript interfaces
├── package.json
├── tsconfig.json
├── Dockerfile             # For containerized deploy
└── README.md
```

---

## 8. Key Considerations

### Puppeteer in Serverless (Vercel/Railway)
- Use `puppeteer-core` instead of `puppeteer`
- Use `chrome-aws-lambda` or `@sparticuz/chromium` for Chromium binary
- Limit to ~50MB bundle size (Vercel constraint)

### Rate Limiting
- Implement simple rate limiting (e.g., 10 requests/min per IP)
- Prevents abuse of the scraping service

### Error Handling
- Timeout after 15-20 seconds per scrape
- Handle Puppeteer crashes gracefully
- Return empty feeds array + error message instead of crashing

### User-Agent & Headers
- Rotate realistic User-Agent strings
- Set proper `Accept-Language`, `Referer` headers
- This helps bypass simple bot detection

---

## 9. Client-Side Changes (React Native)

In `services/feedDiscovery.ts`:
- Replace all client-side scraping logic
- Call `POST https://<your-discovery-service>/discover`
- Pass the user-provided URL
- Map the response to `DiscoveredFeed[]`

This reduces the client code to ~20 lines.

---

## 10. Testing Strategy

1. **Unit Tests**: Mock Puppeteer page, test HTML parsing logic
2. **Integration Tests**: Spin up real server, test against real URLs (Medium, Substack, WordPress, etc.)
3. **Load Tests**: Ensure it handles 10+ concurrent requests

### Test URLs
| URL | Expected Result |
|-----|-----------------|
| `https://medium.com` | Finds Medium Staff feed |
| `https://substack.com` | Finds Substack feeds |
| `https://wordpress.com` | Finds /feed/ |
| `https://example.com` | No feeds found |

---

## 11. Timeline (Estimated)

| Phase | Task | Time |
|-------|------|------|
| 1 | Bootstrap project, install deps | 15 min |
| 2 | Implement core Puppeteer scraper | 1-2 hours |
| 3 | Build Express API + caching | 1 hour |
| 4 | Error handling & logging | 30 min |
| 5 | Deploy to Render/Fly | 30 min |
| 6 | Integrate with React Native app | 30 min |
| 7 | Testing against real URLs | 1 hour |
| **Total** | | **~5-6 hours** |

---

## 12. Next Steps

1. Confirm tech stack (Express vs Fastify, Render vs Fly)
2. Bootstrap the project
3. Implement core scraper
4. Deploy and test against Medium

Would you like me to now **implement the full backend service** and update the React Native client to use it?
