export const MAJOR_KEYWORDS = [
  'release', 'launch', 'announce', 'announce', 'breakthrough', 'beta', 'stable',
  'security breach', 'vulnerability', 'cve', 'critical', 'major update',
  'gpt-5', 'gpt-4', 'claude', 'gemini', 'llama', 'transformer',
  'react 19', 'react native 0.', 'next.js 15', 'typescript 5.',
  'kubernetes 1.', 'docker', 'rust 1.', 'go 1.',
  'acquire', 'acquisition', 'ipo', 'layoffs',
];

export const MINOR_KEYWORDS = [
  'sponsor', 'advertiser', 'promo', 'giveaway', 'contest',
  'job listing', 'hiring', 'career opportunity',
];

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  AI: ['ai', 'machine learning', 'ml', 'gpt', 'llm', 'neural', 'deep learning', 'transformer', 'openai', 'anthropic', 'hugging face', 'chatgpt', 'claude', 'gemini', 'copilot', 'artificial intelligence'],
  Frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'css', 'html', 'frontend', 'ui', 'ux', 'web', 'react native', 'expo', 'next.js', 'vite', 'svelte', 'tailwind'],
  Backend: ['node.js', 'python', 'rust', 'go', 'java', 'c#', 'ruby', 'backend', 'api', 'rest', 'graphql', 'microservice', 'serverless', 'database', 'postgresql', 'mongodb', 'redis'],
  Infrastructure: ['kubernetes', 'docker', 'aws', 'azure', 'gcp', 'cloud', 'devops', 'ci/cd', 'terraform', 'infrastructure', 'container', 'server', 'deployment', 'scalability', 'k8s', 'cloudflare'],
  Security: ['security', 'cve', 'vulnerability', 'exploit', 'breach', 'hack', 'cybersecurity', 'encryption', 'auth', 'oauth', 'ssl', 'tls', 'malware', 'ransomware'],
  Career: ['job', 'salary', 'career', 'interview', 'resume', 'hiring', 'remote work', 'freelance', 'burnout', 'work-life'],
  Tools: ['vscode', 'git', 'github', 'gitlab', 'docker', 'figma', 'tools', 'library', 'framework', 'sdk', 'cli', 'ide', 'extension'],
};
