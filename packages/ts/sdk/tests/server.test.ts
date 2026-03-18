import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAgent } from '../src/agent.js';
import * as fs from 'fs';
import * as path from 'path';

describe('NeuroAgent Server', () => {
  const testConfigPath = path.resolve(process.cwd(), 'test.agent.yaml');

  beforeAll(() => {
    fs.writeFileSync(testConfigPath, `
name: Integration Agent
version: 1.0.0
description: Testing server
author: Tester
license: MIT
capabilities: ["echo"]
model:
  provider: dummy
  name: dummy
`);
  });

  afterAll(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it('serves the AgentCard at /.well-known/agent.json', async () => {
    const agent = createAgent({ config: 'test.agent.yaml' });
    const app = agent.getApp();

    const res = await app.request('/.well-known/agent.json');
    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.name).toBe('Integration Agent');
    expect(card.endpoints.message).toBe('/a2a/message');
  });

  it('handles standard JSON API requests without streaming', async () => {
    const agent = createAgent({ config: 'test.agent.yaml' });
    const app = agent.getApp();

    const res = await app.request('/a2a/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { role: 'user', content: 'hello' },
        stream: false
      })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
  });

  it('handles SSE streaming requests', async () => {
    const agent = createAgent({ config: 'test.agent.yaml' });
    const app = agent.getApp();

    const res = await app.request('/a2a/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { role: 'user', content: 'test stream' },
        stream: true
      })
    });
    
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    
    const text = await res.text();
    // In our mock execute in agent.ts, it yields "Echo: <msg>" then writes it using stream.writeSSE
    expect(text).toContain('data: {"delta":"Echo: test stream"}');
  });
});
