/**
 * defineShell — TypeScript-first config helper.
 *
 * Place in neurogent-shell.config.ts and export default.
 *
 * @example
 * import { defineShell } from '@praesidia/neuro/shell/define';
 *
 * export default defineShell({
 *   agents: [
 *     {
 *       id: 'coder',
 *       name: 'Coder',
 *       role: 'Engineer',
 *       emoji: '⚡',
 *       color: 'cyan',
 *       expertise: ['code', 'typescript', 'debug'],
 *       systemPrompt: 'You are an elite software engineer...',
 *       model: { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' },
 *     },
 *   ],
 * });
 */

import { AgentDef, AgentModel, ShellConfig } from '../types.js';

export interface DefineShellInput {
  name?: string;
  model?: AgentModel;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    emoji?: string;
    color?: string;
    expertise: string[];
    systemPrompt: string;
    model?: AgentModel;
  }>;
}

export function defineShell(input: DefineShellInput): ShellConfig {
  return {
    shellName: input.name ?? 'Neuro Shell',
    globalModel: input.model,
    agents: input.agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      emoji: a.emoji ?? '🤖',
      inkColor: a.color ?? 'white',
      expertise: a.expertise,
      systemPrompt: a.systemPrompt,
      model: a.model,
    })),
  };
}

export type { AgentDef, AgentModel, ShellConfig };
