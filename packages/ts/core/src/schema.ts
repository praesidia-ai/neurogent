import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { AgentCard } from './types.js';

/**
 * The Zod schema for the developer-facing neuro.agent.yaml
 */
export const neuroAgentSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  license: z.string(),
  capabilities: z.array(z.string()),
  
  model: z.object({
    provider: z.string(),
    name: z.string(),
    temperature: z.number().optional().default(0.7),
    max_tokens: z.number().optional().default(4096),
  }),

  memory: z.object({
    type: z.enum(['conversation-buffer', 'redis', 'none']),
    max_messages: z.number().optional().default(50),
  }).optional().default({ type: 'conversation-buffer' }),

  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      type: z.enum(['inline', 'mcp']).optional().default('inline'),
      mcp_server: z.string().optional(),
    })
  ).optional().default([]),

  praesidia: z.object({
    policy: z.string().optional(),
    enforce_on: z.array(z.string()).optional().default([]),
  }).optional(),

  sub_agents: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      endpoint: z.string(),
    })
  ).optional().default([]),

  auth: z.object({
    type: z.enum(['bearer', 'none', 'oauth2']),
  }).optional().default({ type: 'none' }),

  endpoint: z.string().optional().default('/a2a'),
});

export type NeuroAgentConfig = z.infer<typeof neuroAgentSchema>;

/**
 * Parses raw YAML string into a validated NeuroAgentConfig
 */
export function parseAgentConfig(yamlContent: string): NeuroAgentConfig {
  const raw = parseYaml(yamlContent);
  return neuroAgentSchema.parse(raw);
}

/**
 * Compiles a NeuroAgentConfig into a standard A2A AgentCard
 */
export function compileToAgentCard(config: NeuroAgentConfig, praesidiaHash?: string): AgentCard {
  return {
    name: config.name,
    version: config.version,
    description: config.description,
    author: config.author,
    license: config.license,
    capabilities: config.capabilities,
    tools: config.tools.map(t => ({
      name: t.name,
      description: t.description,
      type: t.type,
      mcp_server: t.mcp_server,
    })),
    endpoints: {
      message: `${config.endpoint}/message`,
      tasks: `${config.endpoint}/tasks`,
    },
    sub_agents: config.sub_agents.map(sa => ({
      name: sa.name,
      description: sa.description,
      endpoint: sa.endpoint,
    })),
    'x-praesidia-policy-hash': praesidiaHash,
  };
}
