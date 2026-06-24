import { FeedSource } from '@/types';

const fav = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const GENERAL_KEYWORDS = ['software', 'programming', 'AI', 'developer', 'code', 'app', 'startup', 'cloud', 'api', 'framework', 'javascript', 'python', 'web', 'mobile', 'security', 'hack', 'data', 'machine learning', 'open source', 'github', 'linux', 'microsoft', 'google', 'apple', 'amazon', 'server', 'database', 'devops', 'container'];

export const FEED_SOURCES: FeedSource[] = [
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', icon: fav('theverge.com'), enabled: true, keywords: GENERAL_KEYWORDS },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://arstechnica.com/feed/', icon: fav('arstechnica.com'), enabled: true },
  { id: 'wired', name: 'Wired', url: 'https://www.wired.com/feed/rss', icon: fav('wired.com'), enabled: true },
  { id: 'venturebeat', name: 'VentureBeat', url: 'https://venturebeat.com/feed/', icon: fav('venturebeat.com'), enabled: true },
  { id: 'techcrunch-dev', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', icon: fav('techcrunch.com'), enabled: true },
  { id: 'xda', name: 'XDA', url: 'https://www.xda-developers.com/feed/', icon: fav('xda-developers.com'), enabled: true },
  { id: 'devto', name: 'DEV Community', url: 'https://dev.to/feed', icon: fav('dev.to'), enabled: true },
  { id: 'theregister', name: 'The Register', url: 'https://www.theregister.com/headlines.atom', icon: fav('theregister.com'), enabled: true, keywords: GENERAL_KEYWORDS },
];
