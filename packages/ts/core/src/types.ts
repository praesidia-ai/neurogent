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
