// AgentId is a string — comes from user config, not hardcoded
export type AgentId = string;

export interface AgentModel {
  provider: 'openai' | 'anthropic' | 'ollama' | 'mistral';
  name: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
}

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
  inkColor: string;      // ink/chalk color name
  expertise: string[];   // keywords for auto-routing
  systemPrompt: string;
  model?: AgentModel;    // per-agent model override
}

export interface ShellConfig {
  shellName: string;
  globalModel?: AgentModel;
  agents: AgentDef[];
}

export type MessageType = 'user' | 'agent' | 'system';

export interface Message {
  id: string;
  type: MessageType;
  agentId?: AgentId;
  content: string;
  streaming: boolean;
  timestamp: number;
  cost?: number;
  debateRound?: number;
}

export type AppMode = 'normal' | 'swarm' | 'debate';

export interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}
