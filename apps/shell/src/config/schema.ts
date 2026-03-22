import { z } from 'zod';

export const AgentModelSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'ollama', 'mistral']).default('openai'),
  name: z.string(),
  max_tokens: z.number().int().positive().default(1024),
  temperature: z.number().min(0).max(2).default(0.7),
  base_url: z.string().url().optional(),
});

export const AgentSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/, 'Agent id must be lowercase alphanumeric with _ or -'),
  name: z.string().min(1),
  role: z.string().min(1),
  emoji: z.string().default('🤖'),
  color: z.enum([
    'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    'blackBright', 'redBright', 'greenBright', 'yellowBright',
    'blueBright', 'magentaBright', 'cyanBright', 'whiteBright',
    'gray', 'grey',
  ]).default('white'),
  expertise: z.array(z.string().min(1)).min(1, 'At least one expertise keyword required'),
  system_prompt: z.string().min(1),
  model: AgentModelSchema.optional(),
});

export const ShellYamlSchema = z.object({
  shell: z.object({
    name: z.string().default('Neuro Shell'),
  }).default({ name: 'Neuro Shell' }),
  model: AgentModelSchema.optional(),
  agents: z.array(AgentSchema).min(1, 'At least one agent required'),
});

export type ShellYaml = z.infer<typeof ShellYamlSchema>;
export type AgentYaml = z.infer<typeof AgentSchema>;
