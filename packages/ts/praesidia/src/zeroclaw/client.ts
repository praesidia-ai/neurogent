/**
 * ZeroClaw Client — talks to running ZeroClaw agent servers.
 * Used by the shell executor to route messages to persistent agents.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ZeroClawRegistration {
  agents: Array<{
    id: string;
    name: string;
    url: string;
    port: number;
    pid?: number;
    startedAt: string;
  }>;
  startedAt: string;
}

const RUNTIME_FILE = path.join(process.cwd(), '.neurogent', 'runtime.json');

export function loadRuntime(): ZeroClawRegistration | null {
  try {
    const raw = fs.readFileSync(RUNTIME_FILE, 'utf-8');
    return JSON.parse(raw) as ZeroClawRegistration;
  } catch {
    return null;
  }
}

export function saveRuntime(reg: ZeroClawRegistration): void {
  const dir = path.dirname(RUNTIME_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(reg, null, 2));
}

export function clearRuntime(): void {
  try { fs.unlinkSync(RUNTIME_FILE); } catch { /* already gone */ }
}

export function getAgentUrl(agentId: string): string | null {
  const runtime = loadRuntime();
  if (!runtime) return null;
  const entry = runtime.agents.find(a => a.id === agentId);
  return entry?.url ?? null;
}

/**
 * Health-checks a ZeroClaw instance.
 */
export async function pingAgent(url: string): Promise<{
  alive: boolean;
  agent?: string;
  uptime?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return { alive: false, error: `HTTP ${res.status}` };
    const data = await res.json() as { agent?: string; uptime?: number };
    return { alive: true, agent: data.agent, uptime: data.uptime };
  } catch (err) {
    return { alive: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a message to a ZeroClaw agent and stream the response back.
 * Falls back to non-streaming if the server doesn't support it.
 */
export async function* sendMessage(
  url: string,
  message: string,
): AsyncGenerator<string> {
  try {
    const res = await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stream: true }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok || !res.body) {
      yield `[ZeroClaw error: HTTP ${res.status}]`;
      return;
    }

    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('text/event-stream')) {
      // SSE streaming
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as { chunk?: string; done?: boolean; error?: string };
            if (payload.error) { yield `[Error: ${payload.error}]`; return; }
            if (payload.chunk) yield payload.chunk;
            if (payload.done) return;
          } catch { /* skip malformed */ }
        }
      }
    } else {
      // Non-streaming JSON fallback
      const data = await res.json() as { result?: string; error?: string };
      if (data.error) { yield `[Error: ${data.error}]`; return; }
      if (data.result) yield data.result;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED')) {
      yield `\n[Agent offline — run: neurogent start]\n`;
    } else {
      yield `\n[ZeroClaw error: ${msg}]\n`;
    }
  }
}
