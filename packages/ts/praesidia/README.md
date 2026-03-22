# @praesidia/neurogent

[![npm version](https://img.shields.io/npm/v/@praesidia/neurogent.svg)](https://www.npmjs.com/package/@praesidia/neurogent)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/praesidia/neurogent/blob/main/LICENSE)
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

**Requirements:** Node.js **20+** (ESM). Set **`ANTHROPIC_API_KEY`** and/or **`OPENAI_API_KEY`** in your environment.

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
| `neurogent start` | Start persistent ZeroClaw agent servers from a config file. |
| `neurogent connect` | Connect the shell to a remote ZeroClaw agent server. |
| `neurogent status` | Show health status of registered ZeroClaw agents. |

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

### ZeroClaw (persistent runtime)

```ts
import {
  createAgentServer,
  sendMessage,
  pingAgent,
} from '@praesidia/neurogent';
```

### Security hooks (optional dedicated import)

```ts
import { PraesidiaHooks, parsePolicy } from '@praesidia/neurogent/security';
```

Types are published with the package (`dist/*.d.ts`).

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

Use them as `--config` for `neurogent-shell` or as templates for your own YAML.

---

## Documentation and support

- **Repository & full guide:** [github.com/praesidia/neurogent](https://github.com/praesidia/neurogent)
- **Issues:** [github.com/praesidia/neurogent/issues](https://github.com/praesidia/neurogent/issues)

---

## License

MIT. See the [license file](https://github.com/praesidia/neurogent/blob/main/LICENSE) in the repository.
