import { FeedSource } from '@/types';

const fav = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

export const FEED_SOURCES: FeedSource[] = [
  { id: 'openai', name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', category: 'AI', icon: fav('openai.com'), enabled: true },
  { id: 'anthropic', name: 'Anthropic', url: 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml', category: 'AI', icon: fav('anthropic.com'), enabled: true },
  { id: 'huggingface', name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', category: 'AI', icon: fav('huggingface.co'), enabled: true },
  { id: 'google-ai', name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', category: 'AI', icon: fav('blog.google'), enabled: true },
  { id: 'martin-fowler', name: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom', category: 'AI', icon: fav('martinfowler.com'), enabled: true },

  { id: 'react-native', name: 'React Native Blog', url: 'https://reactnative.dev/blog/feed.xml', category: 'Frontend', icon: fav('reactnative.dev'), enabled: true },
  { id: 'expo', name: 'Expo Blog', url: 'https://blog.expo.dev/feed', category: 'Frontend', icon: fav('expo.dev'), enabled: true },
  { id: 'react', name: 'React Blog', url: 'https://react.dev/rss.xml', category: 'Frontend', icon: fav('react.dev'), enabled: true },
  { id: 'vercel', name: 'Vercel Blog', url: 'https://vercel.com/atom', category: 'Frontend', icon: fav('vercel.com'), enabled: true },
  { id: 'nextjs', name: 'Next.js Blog', url: 'https://nextjs.org/feed.xml', category: 'Frontend', icon: fav('nextjs.org'), enabled: true },
  { id: 'css-tricks', name: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', category: 'Frontend', icon: fav('css-tricks.com'), enabled: true },
  { id: 'smashing', name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', category: 'Frontend', icon: fav('smashingmagazine.com'), enabled: true },

  { id: 'github', name: 'GitHub Blog', url: 'https://github.blog/feed/', category: 'Tools', icon: fav('github.com'), enabled: true },
  { id: 'typescript', name: 'TypeScript', url: 'https://devblogs.microsoft.com/typescript/feed/', category: 'Tools', icon: fav('devblogs.microsoft.com'), enabled: true },
  { id: 'stripe', name: 'Stripe Blog', url: 'https://stripe.com/blog/feed.rss', category: 'Tools', icon: fav('stripe.com'), enabled: true },

  { id: 'nodejs', name: 'Node.js Blog', url: 'https://nodejs.org/en/feed/blog.xml', category: 'Backend', icon: fav('nodejs.org'), enabled: true },
  { id: 'meta-eng', name: 'Engineering at Meta', url: 'https://engineering.fb.com/feed/', category: 'Backend', icon: fav('engineering.fb.com'), enabled: true },
  { id: 'infoq', name: 'InfoQ', url: 'https://www.infoq.com/feed/', category: 'Backend', icon: fav('infoq.com'), enabled: true },

  { id: 'kubernetes', name: 'Kubernetes Blog', url: 'https://kubernetes.io/feed.xml', category: 'Infrastructure', icon: fav('kubernetes.io'), enabled: true },
  { id: 'aws', name: 'AWS News', url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', category: 'Infrastructure', icon: fav('aws.amazon.com'), enabled: true, maxArticles: 10 },
  { id: 'cloudflare', name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/', category: 'Infrastructure', icon: fav('cloudflare.com'), enabled: true },

  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'General', icon: fav('theverge.com'), enabled: true, keywords: ['software', 'programming', 'AI', 'developer', 'code', 'app', 'startup', 'cloud', 'api', 'framework', 'javascript', 'python', 'web', 'mobile', 'security', 'hack', 'data', 'machine learning', 'open source', 'github'] },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://arstechnica.com/feed/', category: 'General', icon: fav('arstechnica.com'), enabled: true },
  { id: 'wired', name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'General', icon: fav('wired.com'), enabled: true },
  { id: 'venturebeat', name: 'VentureBeat', url: 'https://venturebeat.com/feed/', category: 'General', icon: fav('venturebeat.com'), enabled: true },
  { id: 'techcrunch-dev', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'General', icon: fav('techcrunch.com'), enabled: true },
  { id: 'hackernews', name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'General', icon: fav('news.ycombinator.com'), enabled: true },
  { id: 'devto', name: 'DEV Community', url: 'https://dev.to/feed', category: 'General', icon: fav('dev.to'), enabled: true },
  { id: 'theregister', name: 'The Register', url: 'https://www.theregister.com/headlines.atom', category: 'General', icon: fav('theregister.com'), enabled: true, keywords: ['software', 'programming', 'AI', 'developer', 'code', 'cloud', 'api', 'security', 'hack', 'data', 'open source', 'linux', 'microsoft', 'google', 'apple', 'amazon', 'server', 'database', 'devops', 'container'] },
];

export const FEED_CATEGORIES = [
  { key: 'AI', label: 'AI & ML', emoji: 'robot' },
  { key: 'Frontend', label: 'Frontend & Mobile', emoji: 'code' },
  { key: 'Backend', label: 'Backend', emoji: 'server' },
  { key: 'Infrastructure', label: 'Infrastructure', emoji: 'cloud' },
  { key: 'Security', label: 'Security', emoji: 'shield' },
  { key: 'Tools', label: 'Dev Tools', emoji: 'wrench' },
  { key: 'Career', label: 'Career', emoji: 'briefcase' },
  { key: 'General', label: 'General', emoji: 'newspaper' },
] as const;
