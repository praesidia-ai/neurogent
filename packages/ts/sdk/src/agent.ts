import * as fs from 'fs';
import * as path from 'path';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import {
  AgentCard,
  AgentHook,
  ConversationMessage,
  TaskStatus,
  NeuroAgentConfig,
  parseAgentConfig,
  compileToAgentCard,
} from '@neuro/core';
import { Tool } from './tool.js';
import { MCPClient } from './mcp-client.js';
import { MemoryStore, ConversationBufferMemory } from './memory.js';
import { generateText, streamText, tool as aiTool, stepCountIs, LanguageModel, ToolSet } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { mistral } from '@ai-sdk/mistral';
import { z } from 'zod';

// ─── Model routing ────────────────────────────────────────────────────────────

function resolveModel(config: NeuroAgentConfig): LanguageModel {
  const { provider, name } = config.model;
  switch (provider) {
    case 'anthropic':
      return anthropic(name);
    case 'mistral':
      return mistral(name);
    case 'openai':
    default:
      return openai(name);
  }
}

// ─── Neuro Tool → AI SDK ToolSet ─────────────────────────────────────────────

function toAISDKTools(tools: Tool[]): ToolSet {
  return Object.fromEntries(
    tools.map(t => [
      t.name,
      // Cast needed: Neuro's Tool schema is ZodTypeAny; the ai SDK's FlexibleSchema
      // deep-checks _type matching which breaks for generic ZodTypeAny wrappers.
      // Runtime safety is guaranteed by Tool.run() which calls schema.parse().
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiTool({
        description: t.description,
        inputSchema: t.schema as any,
        execute: (args: unknown) => t.run(args),
      } as any),
    ])
  );
}

// ─── Agent context ────────────────────────────────────────────────────────────

export interface AgentContext {
  llm: {
    execute: (msg: ConversationMessage, config: { tools?: Tool[] }) => AsyncIterable<string>;
  };
  tools: Tool[];
  stream: { write: (chunk: string) => Promise<void> };
  delegate: (subAgentName: string, task: string) => Promise<string>;
  memory: MemoryStore;
}

// ─── Builder config ───────────────────────────────────────────────────────────

export interface AgentBuilderConfig {
  config: string;
  tools?: Tool[];
  systemPrompt?: string | ((context: { metadata?: Record<string, string> }) => string);
  hooks?: AgentHook[];
  onMessage?: (msg: ConversationMessage, ctx: AgentContext) => Promise<void>;
}

// ─── NeuroAgent ───────────────────────────────────────────────────────────────

export class NeuroAgent {
  private agentConfig: NeuroAgentConfig;
  private tools: Tool[];
  private hooks: AgentHook[];
  private onMessageHandler?: AgentBuilderConfig['onMessage'];
  private systemPromptSource: AgentBuilderConfig['systemPrompt'];
  private memoryStore: MemoryStore;
  private tasks = new Map<string, TaskStatus>();

  private app: Hono;
  private agentCard: AgentCard;

  constructor(cfg: AgentBuilderConfig) {
    this.tools = cfg.tools ?? [];
    this.hooks = cfg.hooks ?? [];
    this.onMessageHandler = cfg.onMessage;
    this.systemPromptSource = cfg.systemPrompt;

    const rawYaml = fs.readFileSync(path.resolve(process.cwd(), cfg.config), 'utf-8');
    this.agentConfig = parseAgentConfig(rawYaml);

    const policyHash = this.hooks.length > 0 ? this.hooks[0].getPolicyHash() : undefined;
    this.agentCard = compileToAgentCard(this.agentConfig, policyHash);

    this.memoryStore =
      this.agentConfig.memory?.type === 'conversation-buffer'
        ? new ConversationBufferMemory(this.agentConfig.memory.max_messages)
        : new ConversationBufferMemory();

    this.app = new Hono();
    this.setupRoutes();
  }

  // ─── Routes ───────────────────────────────────────────────────────────────

  private setupRoutes() {
    this.app.get('/.well-known/agent.json', c => c.json(this.agentCard));

    this.app.get('/a2a/tasks/:taskId', c => {
      const task = this.tasks.get(c.req.param('taskId'));
      return task ? c.json(task) : c.json({ error: 'Task not found' }, 404);
    });

    this.app.post('/a2a/tasks/:taskId/cancel', c => {
      const task = this.tasks.get(c.req.param('taskId'));
      if (!task) return c.json({ error: 'Task not found' }, 404);
      if (task.state === 'WORKING' || task.state === 'PENDING') {
        task.state = 'CANCELLED';
        task.updatedAt = new Date().toISOString();
      }
      return c.json(task);
    });

    this.app.post('/a2a/message', async c => {
      const body = await c.req.json();
      const isStream: boolean = body.stream === true;
      const inboundMessage: ConversationMessage = body.message;

      const taskId = crypto.randomUUID();
      const now = new Date().toISOString();
      const task: TaskStatus = { taskId, state: 'PENDING', createdAt: now, updatedAt: now };
      this.tasks.set(taskId, task);

      // Ingress hooks
      for (const hook of this.hooks) {
        const result = await hook.checkIngress(inboundMessage.content);
        if (!result.allowed) {
          task.state = 'FAILED';
          task.error = result.reason;
          task.updatedAt = new Date().toISOString();
          return c.json({ taskId, error: 'Security Policy Violation', reason: result.reason }, 403);
        }
      }

      await this.memoryStore.store(inboundMessage);
      task.state = 'WORKING';
      task.updatedAt = new Date().toISOString();

      if (isStream) {
        return streamSSE(c, async stream => {
          const combinedTools = await this.resolveTools();

          const write = async (chunk: string) => {
            let out = chunk;
            for (const hook of this.hooks) {
              const res = await hook.checkEgress(out);
              if (res.allowed && res.modifiedPayload !== undefined) out = res.modifiedPayload;
            }
            await stream.writeSSE({ data: JSON.stringify({ delta: out, taskId }) });
          };

          try {
            if (this.onMessageHandler) {
              await this.onMessageHandler(inboundMessage, this.buildContext(combinedTools, write));
            } else {
              await this.defaultStreamHandler(inboundMessage, combinedTools, write);
            }
            task.state = 'COMPLETED';
            task.updatedAt = new Date().toISOString();
            await stream.writeSSE({ data: JSON.stringify({ done: true, taskId }) });
          } catch (err: unknown) {
            task.state = 'FAILED';
            task.error = err instanceof Error ? err.message : String(err);
            task.updatedAt = new Date().toISOString();
            await stream.writeSSE({ data: JSON.stringify({ error: task.error, taskId }) });
          }
        });
      }

      // Non-streaming
      try {
        const combinedTools = await this.resolveTools();
        const history = await this.memoryStore.query();
        const model = resolveModel(this.agentConfig);
        const sdkTools = combinedTools.length > 0 ? toAISDKTools(combinedTools) : undefined;

        const result = await generateText({
          model,
          system: this.resolveSystemPrompt(),
          messages: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          tools: sdkTools,
          stopWhen: stepCountIs(5),
        });

        let out = result.text;
        for (const hook of this.hooks) {
          const res = await hook.checkEgress(out);
          if (res.allowed && res.modifiedPayload !== undefined) out = res.modifiedPayload;
        }

        await this.memoryStore.store({ role: 'assistant', content: out });
        task.state = 'COMPLETED';
        task.result = out;
        task.updatedAt = new Date().toISOString();

        return c.json({ taskId, state: 'COMPLETED', result: out });
      } catch (err: unknown) {
        task.state = 'FAILED';
        task.error = err instanceof Error ? err.message : String(err);
        task.updatedAt = new Date().toISOString();
        return c.json({ taskId, state: 'FAILED', error: task.error }, 500);
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private resolveSystemPrompt(metadata?: Record<string, string>): string {
    if (!this.systemPromptSource) {
      return `You are ${this.agentCard.name}. ${this.agentCard.description}`;
    }
    return typeof this.systemPromptSource === 'function'
      ? this.systemPromptSource({ metadata })
      : this.systemPromptSource;
  }

  private async resolveTools(): Promise<Tool[]> {
    const dynamic: Tool[] = [];
    for (const t of this.agentCard.tools ?? []) {
      if (t.mcp_server) {
        try {
          const client = new MCPClient(t.mcp_server, []);
          const fetched = await client.fetchTools();
          dynamic.push(...fetched);
        } catch {
          // MCP server unavailable — skip silently in dev
        }
      }
    }
    return [...this.tools, ...dynamic];
  }

  private buildContext(combinedTools: Tool[], write: (chunk: string) => Promise<void>): AgentContext {
    const self = this;
    return {
      llm: {
        async *execute(msg: ConversationMessage, cfg: { tools?: Tool[] }): AsyncIterable<string> {
          const model = resolveModel(self.agentConfig);
          const sdkTools = (cfg.tools ?? []).length > 0 ? toAISDKTools(cfg.tools!) : undefined;
          const result = await streamText({
            model,
            system: self.resolveSystemPrompt(),
            prompt: msg.content,
            tools: sdkTools,
            stopWhen: stepCountIs(5),
          });
          for await (const chunk of result.textStream) {
            yield chunk;
          }
        },
      },
      tools: combinedTools,
      stream: { write },
      delegate: self.delegate.bind(self),
      memory: self.memoryStore,
    };
  }

  private async defaultStreamHandler(
    msg: ConversationMessage,
    tools: Tool[],
    write: (chunk: string) => Promise<void>
  ): Promise<void> {
    const model = resolveModel(this.agentConfig);
    const history = await this.memoryStore.query();
    const sdkTools = tools.length > 0 ? toAISDKTools(tools) : undefined;

    const result = await streamText({
      model,
      system: this.resolveSystemPrompt(),
      messages: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      tools: sdkTools,
      stopWhen: stepCountIs(5),
    });

    let fullReply = '';
    for await (const chunk of result.textStream) {
      fullReply += chunk;
      await write(chunk);
    }

    await this.memoryStore.store({ role: 'assistant', content: fullReply });
  }

  private async delegate(subAgentName: string, task: string): Promise<string> {
    const subAgent = this.agentCard.sub_agents?.find(sa => sa.name === subAgentName);
    if (!subAgent) throw new Error(`Sub-agent "${subAgentName}" not declared in neuro.agent.yaml`);

    const response = await fetch(`${subAgent.endpoint}/a2a/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream: false, message: { role: 'user', content: task } }),
    });

    if (!response.ok) throw new Error(`Delegation to "${subAgentName}" failed: ${response.statusText}`);

    const data = (await response.json()) as { result?: string };
    return data.result ?? JSON.stringify(data);
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  public start(port = 8080): ReturnType<typeof serve> {
    console.log(`[Neuro] ${this.agentCard.name} v${this.agentCard.version} → http://localhost:${port}`);
    console.log(`[Neuro] AgentCard → http://localhost:${port}/.well-known/agent.json`);
    return serve({ fetch: this.app.fetch, port });
  }

  public getApp(): Hono {
    return this.app;
  }
}

export function createAgent(config: AgentBuilderConfig): NeuroAgent {
  return new NeuroAgent(config);
}
