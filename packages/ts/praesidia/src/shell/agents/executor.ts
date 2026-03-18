import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, type CoreMessage } from 'ai';
import { AgentDef, AgentModel, HistoryItem } from '../types.js';

function detectGlobalProvider(): AgentModel {
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', name: 'gpt-4o' };
  }
  return { provider: 'ollama', name: 'llama3.2' };
}

function buildModel(modelConfig: AgentModel): Parameters<typeof streamText>[0]['model'] {
  if (modelConfig.provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
    return anthropic(modelConfig.name);
  }
  if (modelConfig.provider === 'ollama') {
    const ollama = createOpenAI({
      apiKey: 'ollama',
      baseURL: modelConfig.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    });
    return ollama(modelConfig.name);
  }
  const openaiClient = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });
  return openaiClient(modelConfig.name);
}

export function getEffectiveModel(agent: AgentDef, globalModel?: AgentModel): AgentModel {
  return agent.model ?? globalModel ?? detectGlobalProvider();
}

function getGitContext(): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const diff = execSync('git diff --stat HEAD 2>/dev/null || git diff --stat', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const log = execSync('git log --oneline -3', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (!branch || branch === 'HEAD') return '';
    let ctx = `\n\n[Git context — Branch: ${branch}`;
    if (log) ctx += ` | Recent: ${log.split('\n')[0]}`;
    if (diff) ctx += `]\nChanged files:\n${diff}`;
    else ctx += ']';
    return ctx;
  } catch {
    return '';
  }
}

function resolveFileContext(message: string): string {
  // Replace @file:path with file contents
  return message.replace(/@file:([^\s]+)/g, (match, filePath) => {
    try {
      const resolved = path.resolve(process.cwd(), filePath);
      const content = fs.readFileSync(resolved, 'utf-8');
      const ext = path.extname(filePath).slice(1) || 'text';
      const lines = content.split('\n').length;
      return `\n\n[File: ${filePath} (${lines} lines)]\n\`\`\`${ext}\n${content}\n\`\`\``;
    } catch {
      return `[File not found: ${filePath}]`;
    }
  });
}

function calculateCost(model: AgentModel, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-5-sonnet': { input: 3, output: 15 },
    'claude-3-5-haiku': { input: 0.8, output: 4 },
    'claude-3-opus': { input: 15, output: 75 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10, output: 30 },
  };
  const key = Object.keys(pricing).find(k => model.name.includes(k));
  if (!key) return 0; // ollama/local = free
  const p = pricing[key];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export async function* executeAgent(
  agent: AgentDef,
  userMessage: string,
  history: HistoryItem[],
  globalModel?: AgentModel,
  onUsage?: (cost: number) => void,
): AsyncGenerator<string> {
  const modelConfig = getEffectiveModel(agent, globalModel);
  const messageWithFiles = resolveFileContext(userMessage);
  const cleanMessage = messageWithFiles.replace(/@(?!file:)\S+/g, '').trim();

  const messages: CoreMessage[] = [
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: cleanMessage },
  ];

  let model: Parameters<typeof streamText>[0]['model'];
  try {
    model = buildModel(modelConfig);
  } catch (err: unknown) {
    yield `[Provider init error: ${err instanceof Error ? err.message : String(err)}]`;
    return;
  }

  try {
    const result = await streamText({
      model,
      system: `${agent.systemPrompt}\n\nYou are in a terminal chat. Be concise (under 250 words unless asked for more). Markdown renders here.${getGitContext()}`,
      messages,
      maxTokens: modelConfig.maxTokens ?? 1024,
      temperature: modelConfig.temperature ?? 0.7,
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }

    try {
      const usage = await result.usage;
      if (usage && onUsage) {
        const cost = calculateCost(modelConfig, usage.promptTokens, usage.completionTokens);
        onUsage(cost);
      }
    } catch { /* usage not available */ }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.toLowerCase().includes('api key')) {
      yield `\n⚠ API key missing or invalid. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.\n`;
    } else if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      yield `\n⚠ Cannot reach ${modelConfig.provider}. Check your connection or Ollama setup.\n`;
    } else {
      yield `\n⚠ ${agent.name} error: ${msg}\n`;
    }
  }
}
