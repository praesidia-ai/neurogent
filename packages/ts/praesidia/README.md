# @praesidia/neurogent

[![npm version](https://img.shields.io/npm/v/@praesidia/neurogent.svg)](https://www.npmjs.com/package/@praesidia/neurogent)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/praesidia-ai/neurogent/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

**Multi-agent terminal shell and SDK for building A2A-ready AI agents** — run a team of specialists in one TUI session, or scaffold, develop, and ship agents with a single CLI.

---

## Install

```bash
npm install @praesidia/neurogent
```

Global CLI (recommended for `neurogent` / `neurogent-shell` on your `PATH`):

```bash
npm install -g @praesidia/neurogent
```

**Requirements:** Node.js **20+** (ESM). Set **`ANTHROPIC_API_KEY`**, **`OPENAI_API_KEY`**, and/or **`MISTRAL_API_KEY`** in your environment.

---

## What ships in this package

| Surface | Command or import | Purpose |
|--------|-------------------|---------|
| **Shell** | `neurogent-shell` | Full-screen multi-agent terminal (Ink/React). |
| **CLI** | `neurogent` | Scaffold projects, dev server, build AgentCard, deploy, ZeroClaw lifecycle, registry. |
| **Library** | `@praesidia/neurogent` | `createAgent`, tools, memory, MCP client, ZeroClaw runtime, types. |
| **Security** | `@praesidia/neurogent/security` | `PraesidiaHooks`, policy parsing (tree-shake friendly entry). |

Example YAML configs are included under **`examples/`** in the published tarball (see [Examples](#examples)).

---

## Quick start: multi-agent shell

Point the shell at a bundled example (paths differ slightly for global vs local install).

**Global install:**

```bash
export ANTHROPIC_API_KEY=sk-ant-...

neurogent-shell --config "$(npm root -g)/@praesidia/neurogent/examples/dev-trio.yaml"
```

**Local install in a project:**

```bash
export ANTHROPIC_API_KEY=sk-ant-...

npx neurogent-shell --config ./node_modules/@praesidia/neurogent/examples/dev-trio.yaml
```

**Built-in packs** (copy into your repo):

```bash
neurogent-shell packs
neurogent-shell install dev-trio
# then: neurogent-shell --config ./dev-trio.yaml   # or the path printed by install
```

---

## CLI overview

```bash
neurogent --help
```

| Command | Description |
|---------|-------------|
| `neurogent init` | Scaffold a new Neuro agent project. |
| `neurogent dev` | Start a local A2A server with hot reload. |
| `neurogent build` | Validate config and generate an AgentCard. |
| `neurogent deploy` | Generate production Docker artifacts. |
| `neurogent register` | Publish your AgentCard to an A2A directory registry. |
| `neurogent start` | Launch persistent ZeroClaw agent servers from a YAML config file. |
| `neurogent connect` | Connect the shell to a remote ZeroClaw agent server. |
| `neurogent status` | Health-check all registered ZeroClaw agents. |

---

## ZeroClaw — persistent agent runtime

ZeroClaw turns each agent definition into a **long-running HTTP server**. Instead of spawning a fresh LLM call per message, agents stay alive between turns, maintain conversation history, and expose a stable webhook URL for task delivery.

The shell automatically routes messages through ZeroClaw when a running instance is detected, falling back to a direct LLM call when no server is available.

### Starting agents

`neurogent start` reads your shell YAML config and starts one Hono HTTP server per agent, beginning at port **4100** by default:

```bash
neurogent start                            # auto-discovers neurogent-shell.yaml
neurogent start --config marketing.yaml    # explicit config
neurogent start --base-port 5000           # start ports from 5000
```

Each agent gets its own port (`4100`, `4101`, `4102`, ...`). On startup, agent URLs are saved to **`.neurogent/runtime.json`** so the shell and CLI can discover them automatically. The servers run until `Ctrl+C`, which gracefully stops all instances and clears the runtime file.

### Checking status

```bash
neurogent status              # one-shot health check
neurogent status --watch      # refresh every 3 seconds
```

Output shows each agent's URL, online/offline indicator, and uptime in seconds. If no agents are registered it prints instructions to run `neurogent start` or `neurogent connect`.

### Connecting to a remote server

When your ZeroClaw servers run on a remote host (or a different machine), use `neurogent connect` to point the shell at them:

```bash
# Connect all agents to a single remote host
neurogent connect --url http://my-server:4100

# Connect a specific agent only
neurogent connect --url http://my-server:4101 --agent engineer

# Remove the remote connection and fall back to local LLM
neurogent connect --clear
```

The command pings the target before saving, so you get an immediate error if the server is unreachable.
Remote connections are stored in `.neurogent/runtime.json` alongside local ones. If `--agent` is omitted a wildcard entry (`id: "*"`) is written, which the shell uses for any agent not otherwise registered.

---

## ZeroClaw HTTP API

Every agent server started by `neurogent start` (or `createAgentServer`) exposes these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe. Returns `{ status, agent, role, port, uptime, tasks }`. |
| `GET` | `/.well-known/agent.json` | A2A AgentCard (name, version, capabilities, endpoints). |
| `POST` | `/webhook` | Deliver a task or message to the agent. |
| `GET` | `/a2a/tasks/:taskId` | Fetch the status of a specific task. |
| `GET` | `/a2a/tasks` | List the last 20 tasks. |

### POST /webhook — request body

```json
{
  "message": "Explain the auth flow",
  "stream": true
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `message` | `string` | required | The user prompt. Also accepted as `text` or `prompt`. |
| `stream` | `boolean` | `false` | Stream the response as SSE. |

**Non-streaming response:**

```json
{
  "taskId": "task_1710000000_abc123",
  "state": "COMPLETED",
  "result": "The auth flow works as follows..."
}
```

**Streaming response** — `Content-Type: text/event-stream`, one event per chunk:

```
data: {"chunk":"The auth"}
data: {"chunk":" flow works..."}
data: {"done":true,"taskId":"task_1710000000_abc123"}
```

On error the stream emits `data: {"error":"<message>"}` and closes.

The `X-Task-Id` response header contains the task ID regardless of streaming mode.

---

## Programmatic usage

ESM only (`"type": "module"`).

### Agent, tools, and memory

```ts
import {
  createAgent,
  Tool,
  ConversationBufferMemory,
  parseAgentConfig,
} from '@praesidia/neurogent';

const config = parseAgentConfig(/* YAML string or object */);
const agent = createAgent(config);
// Use Tool, memory helpers, and streaming per your setup.
```

### ZeroClaw runtime — start a persistent server

```ts
import { createAgentServer } from '@praesidia/neurogent';

const server = createAgentServer(
  {
    id: 'engineer',
    name: 'Engineer',
    role: 'Full-Stack',
    emoji: '⚡',
    inkColor: 'cyan',
    expertise: ['code', 'typescript', 'react'],
    systemPrompt: 'You are a senior full-stack engineer.',
  },
  4100,                // port
  { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' }, // optional global model — also: 'openai' | 'mistral' | 'ollama'
);

const instance = await server.start();
// instance.url  → "http://localhost:4100"

// Graceful stop
server.stop();
```

### ZeroClaw client — send messages and manage the runtime registry

```ts
import {
  sendMessage,
  pingAgent,
  loadRuntime,
  saveRuntime,
  clearRuntime,
  getAgentUrl,
} from '@praesidia/neurogent';

// Health check
const health = await pingAgent('http://localhost:4100');
// { alive: true, agent: 'Engineer', uptime: 42 }

// Stream a response
for await (const chunk of sendMessage('http://localhost:4100', 'Write a login handler')) {
  process.stdout.write(chunk);
}

// Read the runtime registry written by `neurogent start`
const runtime = loadRuntime();
// { agents: [{ id, name, url, port, pid, startedAt }], startedAt }

// Look up a specific agent's URL
const url = getAgentUrl('engineer'); // "http://localhost:4100" or null
```

### Shell executor — ZeroClaw routing

When the shell calls `executeAgent`, it checks for a ZeroClaw URL in this priority order:

1. `agent.zeroClawUrl` — inline URL on the agent definition
2. `getAgentUrl(agent.id)` — lookup by agent ID in `.neurogent/runtime.json`
3. `getAgentUrl('*')` — wildcard entry written by `neurogent connect`
4. Falls through to a direct LLM call if none are found

This means you can mix locally-served agents, remotely-connected agents, and live-LLM agents in the same shell session.

### Security hooks (optional dedicated import)

```ts
import { PraesidiaHooks, parsePolicy } from '@praesidia/neurogent/security';
```

Types are published with the package (`dist/*.d.ts`).

---

## Shell YAML config format

```yaml
shell:
  name: "My Team"

# Global model — agents inherit this unless they override it
model:
  provider: anthropic          # anthropic | openai | mistral | ollama
  name: claude-3-5-sonnet-20241022
  max_tokens: 1024             # optional
  temperature: 0.7             # optional
  base_url: http://...         # optional, for Ollama or custom endpoints

agents:
  - id: engineer               # lowercase alphanumeric + _ or -
    name: Engineer
    role: Full-Stack
    emoji: "⚡"
    color: cyan                # ink terminal color name
    expertise:
      - code
      - typescript
      - react
    system_prompt: |
      You are a senior full-stack engineer...
    model:                     # optional per-agent override
      provider: openai
      name: gpt-4o
```

Expertise keywords drive automatic routing — when you type a message, the shell scores each agent by keyword match and routes to the best fit. Use `@agent-id` or `@agent-name` to explicitly target an agent.

---

## Exported API reference

All exports from `@praesidia/neurogent`:

| Export | Kind | Description |
|--------|------|-------------|
| `createAgent` | function | Build a `NeuroAgent` from a builder config. |
| `NeuroAgent` | class | Full A2A agent with Hono server, hooks, memory, MCP. |
| `Tool` | class | Define a typed tool with Zod schema + execute handler. |
| `ConversationBufferMemory` | class | Fixed-window conversation history store. |
| `LocalSemanticMemory` | class | In-memory semantic memory store. |
| `MCPClient` | class | Fetch tools from a running MCP server. |
| `PraesidiaHooks` | class | Security ingress/egress/tool-execution hooks. |
| `parsePolicy` | function | Parse a `praesidia.policy.yaml` string into a typed policy. |
| `parseAgentConfig` | function | Parse a `neuro.agent.yaml` YAML string into a typed config. |
| `compileToAgentCard` | function | Compile a `NeuroAgentConfig` into a serialisable `AgentCard`. |
| `neuroAgentSchema` | Zod schema | Zod schema for `neuro.agent.yaml`. |
| `createAgentServer` | function | Create a ZeroClaw persistent Hono HTTP server for an agent. |
| `sendMessage` | async generator | POST to `/webhook` and stream SSE chunks. |
| `pingAgent` | function | GET `/health` with a 3-second timeout. |
| `loadRuntime` | function | Read `.neurogent/runtime.json`. |
| `saveRuntime` | function | Write `.neurogent/runtime.json`. |
| `clearRuntime` | function | Delete `.neurogent/runtime.json`. |
| `getAgentUrl` | function | Look up a registered agent URL by ID. |

---

## Examples

These files are published with the package:

| File | Use |
|------|-----|
| `examples/dev-trio.yaml` | Small engineering + security + review team. |
| `examples/dev-trio-openai.yaml` | Same idea, OpenAI-oriented. |
| `examples/full-team.yaml` | Larger multi-agent org. |
| `examples/marketing-team.yaml` | Marketing-focused agents. |
| `examples/solo-researcher.yaml` | Single deep-research agent. |

Use them as `--config` for `neurogent-shell` or `neurogent start`, or as templates for your own YAML.

---

## Documentation and support

- **Repository & full guide:** [github.com/praesidia/neurogent](https://github.com/praesidia-ai/neurogent)
- **Issues:** [github.com/praesidia/neurogent/issues](https://github.com/praesidia-ai/neurogent/issues)

---

## License

MIT. See the [license file](https://github.com/praesidia-ai/neurogent/blob/main/LICENSE) in the repository.
