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
  { id: 'theregister', name: 'The Register', url: 'https://www.theregister.com/headlines.atom', icon: fav('theregister.com'), enabled: true, keywords: GENERAL_KEYWORDS },
  { id: 'notebookcheck', name: 'Notebookcheck', url: 'https://www.notebookcheck.net/RSS-Feed-Notebook-Reviews.8156.0.html', icon: 'https://www.google.com/s2/favicons?domain=www.notebookcheck.net&sz=64', enabled: true },
  { id: '9to5linux', name: '9to5Linux', url: 'https://9to5linux.com/feed', icon: 'https://www.google.com/s2/favicons?domain=9to5linux.com&sz=64', enabled: true },
  { id: 'infoworld', name: 'InfoWorld', url: 'https://www.infoworld.com/feed/', icon: 'https://www.google.com/s2/favicons?domain=www.infoworld.com&sz=64', enabled: true },
  { id: 'openai', name: 'OpenAI', url: 'https://openai.com/news/rss.xml', icon: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64', enabled: true },
  { id: 'developer-tech', name: 'Developer Tech', url: 'https://www.developer-tech.com/feed/', icon: 'https://www.google.com/s2/favicons?domain=www.developer-tech.com&sz=64', enabled: true },
  { id: 'kdnuggets', name: 'KDnuggets', url: 'https://www.kdnuggets.com/feed/', icon: 'https://www.google.com/s2/favicons?domain=www.kdnuggets.com&sz=64', enabled: true },
  { id: 'marktechpost', name: 'Marktechpost', url: 'https://marktechpost.com/feed', icon: 'https://www.google.com/s2/favicons?domain=marktechpost.com&sz=64', enabled: true },
];
