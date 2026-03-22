/**
 * ZeroClaw Runtime — Hono HTTP server that exposes a Neurogent agent
 * as a persistent, A2A-compatible service.
 *
 * Each agent gets its own server on a dedicated port:
 *   GET  /health                  — liveness probe
 *   GET  /.well-known/agent.json  — A2A AgentCard
 *   POST /webhook                 — receive task/message
 *   GET  /a2a/tasks/:taskId       — task status
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { executeAgent } from '../shell/agents/executor.js';
import type { AgentDef, AgentModel, HistoryItem } from '../shell/types.js';

export interface ZeroClawInstance {
  agent: AgentDef;
  port: number;
  url: string;
  startedAt: string;
}

interface TaskRecord {
  taskId: string;
  state: 'PENDING' | 'WORKING' | 'COMPLETED' | 'FAILED';
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export function createAgentServer(
  agent: AgentDef,
  port: number,
  globalModel?: AgentModel,
): { start: () => Promise<ZeroClawInstance>; stop: () => void } {
  const app = new Hono();
  const tasks = new Map<string, TaskRecord>();
  const history: HistoryItem[] = [];
  const startedAt = new Date().toISOString();
  let serverClose: (() => void) | null = null;

  // ── Health ───────────────────────────────────────────────────────────────
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      agent: agent.name,
      role: agent.role,
      port,
      uptime: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
      tasks: tasks.size,
    });
  });

  // ── AgentCard ────────────────────────────────────────────────────────────
  app.get('/.well-known/agent.json', (c) => {
    return c.json({
      name: agent.name,
      version: '1.0.0',
      description: agent.role,
      capabilities: agent.expertise,
      endpoints: {
        message: `http://localhost:${port}/webhook`,
        tasks: `http://localhost:${port}/a2a/tasks`,
      },
    });
  });

  // ── Webhook — receive task ────────────────────────────────────────────────
  app.post('/webhook', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const message: string = body.message ?? body.text ?? body.prompt ?? '';
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stream = body.stream ?? false;

    if (!message) {
      return c.json({ error: 'message field required' }, 400);
    }

    const record: TaskRecord = {
      taskId,
      state: 'WORKING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.set(taskId, record);

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let fullResponse = '';
            for await (const chunk of executeAgent(agent, message, history, globalModel)) {
              fullResponse += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
            history.push({ role: 'user', content: message });
            history.push({ role: 'assistant', content: fullResponse });
            if (history.length > 20) history.splice(0, history.length - 20);
            record.state = 'COMPLETED';
            record.result = fullResponse;
            record.updatedAt = new Date().toISOString();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, taskId })}\n\n`));
          } catch (err) {
            record.state = 'FAILED';
            record.error = String(err);
            record.updatedAt = new Date().toISOString();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: record.error })}\n\n`));
          }
          controller.close();
        },
      });
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Task-Id': taskId,
        },
      });
    }

    // Non-streaming — collect and return
    try {
      let fullResponse = '';
      for await (const chunk of executeAgent(agent, message, history, globalModel)) {
        fullResponse += chunk;
      }
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: fullResponse });
      if (history.length > 20) history.splice(0, history.length - 20);
      record.state = 'COMPLETED';
      record.result = fullResponse;
      record.updatedAt = new Date().toISOString();
      return c.json({ taskId, state: 'COMPLETED', result: fullResponse });
    } catch (err) {
      record.state = 'FAILED';
      record.error = String(err);
      record.updatedAt = new Date().toISOString();
      return c.json({ taskId, state: 'FAILED', error: record.error }, 500);
    }
  });

  // ── Task status ──────────────────────────────────────────────────────────
  app.get('/a2a/tasks/:taskId', (c) => {
    const taskId = c.req.param('taskId');
    const task = tasks.get(taskId);
    if (!task) return c.json({ error: 'Task not found' }, 404);
    return c.json(task);
  });

  // ── List tasks ───────────────────────────────────────────────────────────
  app.get('/a2a/tasks', (c) => {
    return c.json([...tasks.values()].slice(-20));
  });

  return {
    async start(): Promise<ZeroClawInstance> {
      return new Promise((resolve) => {
        const server = serve({ fetch: app.fetch, port }, () => {
          resolve({ agent, port, url: `http://localhost:${port}`, startedAt });
        });
        serverClose = () => server.close();
      });
    },
    stop() {
      serverClose?.();
    },
  };
}
