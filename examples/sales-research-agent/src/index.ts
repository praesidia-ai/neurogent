import { createAgent, Tool } from '@neuro/sdk';
import { PraesidiaHooks } from '@praesidia/neurogent';
import { z } from 'zod';

// Tool: scrape a public URL and return its visible text
const scrapeTool = new Tool({
  name: 'scrape-website',
  description: 'Fetches a public URL and returns its plain-text content',
  schema: z.object({
    url: z.string().url().describe('The URL to fetch'),
  }),
  execute: async ({ url }) => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NeuroAgent/0.1 (research bot)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const html = await res.text();
    // Strip HTML tags, collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return text.slice(0, 8_000); // keep context window manageable
  },
});

const agent = createAgent({
  config: './neuro.agent.yaml',
  tools: [scrapeTool],
  systemPrompt:
    'You are an expert sales analyst. ' +
    'When given a company name or URL, use the scrape-website tool to research it, ' +
    'then produce a concise sales strategy with key talking points.',
  hooks: [PraesidiaHooks.withPolicy('./praesidia.policy.yaml')],
});

agent.start(Number(process.env.PORT) || 8080);
