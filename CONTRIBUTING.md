# Contributing to Neurogent

Thank you for taking the time to contribute. Every PR, issue, and idea makes Neurogent better for everyone.

---

## Table of contents

- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Ways to contribute](#ways-to-contribute)
- [Development workflow](#development-workflow)
- [Pull request guidelines](#pull-request-guidelines)
- [Code style](#code-style)
- [Reporting bugs](#reporting-bugs)
- [Feature requests](#feature-requests)
- [Community](#community)

---

## Getting started

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/neurogent.git
cd neurogent

# 2. Install dependencies
npm install

# 3. Build all packages
npm run build

# 4. Run the shell locally
cd packages/ts/praesidia
../../node_modules/.bin/tsx src/shell/index.tsx --config examples/dev-trio.yaml
```

You'll need at least one API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # recommended
# or
export OPENAI_API_KEY=sk-...
```

---

## Project structure

```
neurogent/
├── packages/ts/praesidia/   ← @praesidia/neurogent (the single published package)
│   ├── src/
│   │   ├── index.ts         ← SDK exports (createAgent, Tool, types)
│   │   ├── types.ts         ← shared types (AgentHook, AgentCard, A2A types)
│   │   ├── sdk/             ← agent runtime (agent.ts, tool.ts, memory.ts, mcp-client.ts)
│   │   ├── security/        ← PraesidiaHooks (policy enforcement, PII redaction)
│   │   ├── shell/           ← terminal UI (Ink + React)
│   │   └── cli/             ← CLI commands (init, dev, build, deploy, register)
│   └── examples/            ← built-in agent packs (YAML configs)
├── examples/
│   └── sales-research-agent/ ← full example agent with tools
├── scripts/
│   └── release.sh           ← build + publish script
├── LICENSE
└── README.md
```

---

## Ways to contribute

### Add a new agent pack

The fastest and highest-impact contribution. A pack is a single YAML file.

```bash
cp packages/ts/praesidia/examples/dev-trio.yaml packages/ts/praesidia/examples/my-team.yaml
```

Edit the agents — names, roles, personalities, expertise keywords. Open a PR and we'll add it to the built-in packs.

**Packs we'd love to see:**
- Legal team (contract review, compliance, IP)
- Design team (UX, visual, copy, research)
- Finance team (modeling, analysis, reporting)
- Data science team (ML, stats, visualization)
- Startup team (founder, growth, ops, fundraising)

### Add a provider adapter

Currently supported: `anthropic`, `openai`, `ollama`.

To add a new provider (e.g. Gemini):

1. Add a new case in `packages/ts/praesidia/src/sdk/agent.ts` → `resolveModel()`
2. Add the same case in `packages/ts/praesidia/src/shell/agents/executor.ts` → `buildModel()`
3. Update the YAML schema in `packages/ts/praesidia/src/types.ts` (provider union type)
4. Add an example YAML using the new provider

### Add MCP server integrations

MCP tools are configured in `neuro.agent.yaml` under `tools[].mcp_server`. The client is in `src/sdk/mcp-client.ts`.

Popular integrations to add:
- `filesystem` — read/write local files
- `browser` — web browsing and scraping
- `postgres` — direct database queries
- `github` — repo management

### Improve the shell

The terminal UI lives in `src/shell/`. It's built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs).

Ideas:
- Session history (navigate previous sessions)
- Agent pinning (always include an agent in every response)
- Better markdown rendering in the feed
- Keyboard shortcuts for common commands

### Fix a bug or improve docs

Check the [issues](https://github.com/praesidia/neurogent/issues) tab. Issues labeled `good first issue` are great starting points.

---

## Development workflow

```bash
# Create a feature branch
git checkout -b feat/my-feature

# Make changes in packages/ts/praesidia/src/

# Build and verify
cd packages/ts/praesidia && npm run build

# Test manually
../../node_modules/.bin/tsx src/shell/index.tsx --config examples/dev-trio.yaml

# Run tests
npm test
```

---

## Pull request guidelines

- **Keep PRs small and focused** — one feature or fix per PR
- **Write a clear description** — what changed and why
- **Test your changes** — run the shell manually with at least one config
- **Add tests** for new functionality if possible
- **Update docs** if your change affects the README or CONTRIBUTING
- **Reference issues** — use `Closes #123` in the PR description if applicable

We review all PRs within **48 hours**. If you haven't heard back, feel free to ping in Discord.

---

## Code style

- **TypeScript strict mode** — no `any` without a comment explaining why
- **ESM only** — all imports use `.js` extensions (even for `.ts` files)
- **Functional where possible** — prefer pure functions over classes for utilities
- **Explicit over clever** — readable code beats clever code every time
- **No unused imports** — keep files clean

Run the linter before opening a PR:

```bash
cd packages/ts/praesidia && npm run lint
```

---

## Reporting bugs

Open an issue with:

1. **Command you ran** (with config file if relevant)
2. **Expected behavior**
3. **Actual behavior** (include full error output)
4. **Environment**: Node version, OS, terminal emulator

---

## Feature requests

Open an issue with the `enhancement` label. Describe:

1. **The problem you're trying to solve** (not just the solution)
2. **Your proposed solution**
3. **Alternatives you've considered**

---

## Community

- **GitHub Discussions** — questions, ideas, show-and-tell
- **GitHub Issues** — bugs and feature requests
- **Discord** — real-time chat with the team and community → [discord.gg/neurogent](https://discord.gg/neurogent)

---

**Thank you for contributing. Every star, PR, and issue helps build something people love.**
