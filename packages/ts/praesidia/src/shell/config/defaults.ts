import { ShellConfig } from '../types.js';

/**
 * Built-in fallback config used when no neurogent-shell.yaml is found.
 * Shows a minimal "getting started" 2-agent setup.
 */
export const DEFAULT_CONFIG: ShellConfig = {
  shellName: 'Neuro Shell',
  globalModel: {
    provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai',
    name: process.env.ANTHROPIC_API_KEY
      ? 'claude-3-5-sonnet-20241022'
      : 'gpt-4o',
  },
  agents: [
    {
      id: 'assistant',
      name: 'Assistant',
      role: 'General',
      emoji: '🤖',
      inkColor: 'cyan',
      expertise: ['help', 'question', 'explain', 'what', 'how', 'why', 'tell me'],
      systemPrompt:
        'You are a helpful, knowledgeable assistant. Be concise and clear. Format responses for the terminal with minimal markdown.',
    },
    {
      id: 'coder',
      name: 'Coder',
      role: 'Engineer',
      emoji: '⚡',
      inkColor: 'green',
      expertise: ['code', 'debug', 'function', 'class', 'bug', 'error', 'typescript', 'python', 'javascript', 'refactor', 'review'],
      systemPrompt:
        'You are an elite software engineer. Write clean, efficient code. Always explain your reasoning briefly. Use markdown code blocks with proper language tags.',
    },
  ],
};
