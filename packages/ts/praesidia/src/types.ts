/**
 * Represents the fundamental A2A message types.
 */
export interface A2AMessage {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, any>;
  id?: string | number;
}

/**
 * Common roles for standard conversational tasks.
 */
export type Role = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Message payload within the A2A specification.
 */
export interface ConversationMessage {
  role: Role;
  content: string;
  name?: string;
  tool_call_id?: string;
}

/**
 * A2A Standard Task states.
 */
export type TaskState = 'PENDING' | 'WORKING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'ESCALATION_REQUIRED';

export interface TaskStatus {
  taskId: string;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
  result?: any;
  error?: string;
}

/**
 * Generic hook result used by ingress/egress guards.
 */
export interface HookResult {
  allowed: boolean;
  reason?: string;
  modifiedPayload?: string;
}

/**
 * Pluggable security/policy hook interface.
 * Implement this to add ingress filtering, egress redaction,
 * or tool-level authorization without coupling to any specific provider.
 */
export interface AgentHook {
  getPolicyHash(): string;
  checkIngress(payload: string): Promise<HookResult>;
  checkEgress(chunk: string): Promise<HookResult>;
  checkTool(toolName: string): Promise<HookResult>;
}

/**
 * A2A AgentCard representation.
 * Exposed at /.well-known/agent.json
 */
export interface AgentCard {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  capabilities: string[];
  tools?: Array<{
    name: string;
    description: string;
    type?: string;
    mcp_server?: string;
  }>;
  endpoints: {
    message: string;
    tasks: string;
  };
  sub_agents?: Array<{
    name: string;
    description: string;
    endpoint: string;
  }>;
  'x-praesidia-policy-hash'?: string;
}

// ── Schema types (from @neuro/core schema) ───────────────────────────────────

import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

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
