import { describe, it, expect } from 'vitest';
import { parseAgentConfig, compileToAgentCard } from '../src/schema.js';

describe('neuroAgentSchema', () => {
  it('parses a valid basic yaml config', () => {
    const yaml = `
name: Test Agent
version: 1.0.0
description: A test agent
author: Tester
license: MIT
capabilities: ["test"]
model:
  provider: openai
  name: gpt-4o
`;
    const config = parseAgentConfig(yaml);
    expect(config.name).toBe('Test Agent');
    expect(config.model.temperature).toBe(0.7); // default
    expect(config.endpoint).toBe('/a2a'); // default
  });

  it('compiles config to AgentCard', () => {
    const yaml = `
name: Test Agent
version: 1.0.0
description: A test agent
author: Tester
license: MIT
capabilities: ["test"]
model:
  provider: openai
  name: gpt-4o
`;
    const config = parseAgentConfig(yaml);
    const card = compileToAgentCard(config, 'hash123');
    
    expect(card.name).toBe('Test Agent');
    expect(card.endpoints.message).toBe('/a2a/message');
    expect(card['x-praesidia-policy-hash']).toBe('hash123');
  });
});
