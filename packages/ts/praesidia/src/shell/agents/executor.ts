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

export async function* executeAgent(
  agent: AgentDef,
  userMessage: string,
  history: HistoryItem[],
  globalModel?: AgentModel,
): AsyncGenerator<string> {
  const modelConfig = getEffectiveModel(agent, globalModel);
  const cleanMessage = userMessage.replace(/@\S+/g, '').trim();

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
      system: `${agent.systemPrompt}\n\nYou are in a terminal chat. Be concise (under 250 words unless asked for more). Markdown renders here.`,
      messages,
      maxOutputTokens: modelConfig.maxTokens ?? 1024,
      temperature: modelConfig.temperature ?? 0.7,
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
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
