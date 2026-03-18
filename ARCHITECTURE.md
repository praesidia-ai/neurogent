# Neuro Architecture & Design Document

Neuro is a lightweight open-source framework and CLI for creating, packaging, and registering A2A-compliant AI agents with first-class integration with Praesidia as the trust/security layer.

## 1. Repository structure

We will use a **pnpm workspaces monorepo** driven by **Turborepo** for TS components, alongside a Poetry/uv-based structure for Python packages. This allows unified versioning of the CLI and core SDKs while keeping language ecosystems native.

```text
neuro/
├── apps/
│   ├── cli/                   # The `neuro` CLI tool (Node.js/Commander)
│   └── docs/                  # Documentation site (Nextra or VitePress)
├── packages/
│   ├── ts/                    # TypeScript workspace
│   │   ├── core/              # @neuro/core: shared logic, AgentCard generation, A2A types
│   │   ├── sdk/               # @neuro/sdk: TS developer SDK (`createAgent`)
│   │   ├── praesidia/         # @neuro/praesidia: Praesidia adapter & middleware
│   │   └── testing/           # @neuro/testing: test harness for simulating A2A messages
│   └── python/                # Python workspace (managed via uv/poetry)
│       ├── neuro-core/        # Python port of core logic
│       ├── neuro-sdk/         # Python developer SDK
│       └── neuro-praesidia/   # Python Praesidia adapter
├── templates/                 # Scaffolding templates for `neuro init`
│   ├── ts-basic/
│   ├── ts-praesidia/
│   ├── py-fastapi/
│   └── py-langchain/
├── examples/                  # Real-world working reference agents
└── a2a-spec/                  # Git submodule or local snapshot of the A2A protocol spec
```

## 2. Agent definition format

The agent definition schema (`neuro.agent.yaml`) serves as the single source of truth. At build time, Neuro compiles this into a standardized **A2A AgentCard (JSON)** and injects Praesidia policy hooks.

```yaml
# neuro.agent.yaml
name: Sales Research Agent
version: 1.0.0
description: Analyzes a target company and generates a custom sales outreach strategy.

# A2A Compliant Identification
author: Acme Corp
license: MIT
capabilities:
  - web-search
  - document-analysis
  - outbound-email

# Model Configuration
model:
  provider: openai
  name: gpt-4o
  temperature: 0.2
  max_tokens: 4096

# Memory / Persistence
memory:
  type: conversation-buffer
  max_messages: 50

# Tools / MCP Compatibility
tools:
  - name: search-crm
    description: Retrieves existing contact info from HubSpot
    mcp_server: internal-hubspot-mcp
  - name: scrape-website
    description: Extracts text from a public URL
    type: inline # Implementation provided in code

# Praesidia Trust & Security Hooks
praesidia:
  policy: ./praesidia.policy.yaml
  enforce_on:
    - prompt_injection # Filter incoming A2A messages
    - pii_leakage      # Redact outbound PII
    - tool_execution   # Just-In-Time approval for CRM mutation

# A2A Communication
auth:
  type: bearer
endpoint: /a2a
```

## 3. CLI commands

The `neuro` CLI encapsulates the entire developer lifecycle.

*   `neuro init <project-name> [--template <template>]`
    *   **Flags:** `--template` (e.g., `ts-basic`, `py-fastapi`), `--with-praesidia`.
    *   **Action:** Scaffolds a new project directory with `neuro.agent.yaml`, `src/index.ts`, `package.json`, and basic test harness.
    *   **Output:** Ready-to-run local project repository.

*   `neuro dev`
    *   **Flags:** `--port <number>` (default: 8080), `--watch`.
    *   **Action:** Starts a local A2A-compliant dev server with hot reload. Exposes standard A2A endpoints locally.
    *   **Output:** URL `http://localhost:8080`. Streams active logs, tool calls, and Praesidia policy evaluations in the terminal.

*   `neuro build`
    *   **Flags:** `--out-dir <path>`, `--format <docker|tar>`.
    *   **Action:** Validates `neuro.agent.yaml` against schema. Generates the standard `AgentCard` (`.well-known/agent.json`), bundles the code, and builds a specialized lightweight Docker container.
    *   **Output:** A deployable artifact (Docker image or tarball) and `dist/` folder containing the compiled AgentCard.

*   `neuro deploy`
    *   **Flags:** `--target <docker|aws|railway>`, `--env <file>`.
    *   **Action:** Pushes the artifact to the designated target environment and provisions necessary secrets.
    *   **Output:** The public URL of the deployed agent.

*   `neuro register`
    *   **Flags:** `--registry <url>`.
    *   **Action:** Submits the generated AgentCard to an A2A directory network, making the agent discoverable by other A2A agents.
    *   **Output:** Registration ID and network URL.

*   `neuro connect praesidia`
    *   **Flags:** `--project-id <id>`, `--env <staging|prod>`.
    *   **Action:** Authenticates with Praesidia cloud, downloads the associated Trust Policy for the agent, and writes `praesidia.policy.yaml` locally.

*   `neuro test`
    *   **Flags:** `--suite <file>`, `--ci`.
    *   **Action:** Spins up the agent in memory, fires mock A2A JSON-RPC 2.0 messages, and asserts responses and tool invocations.
    *   **Output:** Test execution report.

## 4. A2A runtime layer

When an agent is run (via `neuro dev` or in production), it spins up an embedded, high-performance HTTP server (powered by Hono on Node/Bun and FastAPI on Python). This server strictly implements the A2A HTTP + JSON-RPC + SSE standard.

**Exposed Endpoints:**
*   `GET /.well-known/agent.json`: Serves the static A2A `AgentCard` built from `neuro.agent.yaml`.
*   `POST /message/send`: Accepts an A2A standard message payload.
*   `GET /tasks/get?id=<id>`: Returns the status of an active task (PENDING → WORKING → COMPLETED/FAILED).
*   `POST /tasks/cancel`: Interrupts an ongoing LLM generation or tool execution.

**Streaming & Execution:**
*   Neuro handles SSE natively. When a message is received at `/message/send` with `stream: true`, the runtime defers to the SDK's execution loop, formatting LLM output chunks into A2A-compliant SSE events (`event: chunk`, `data: {"delta": "..."}`).
*   **Task State Machine:** Every message generates a universally unique Task ID. The state transitions are internally managed by the Neuro runtime engine, writing state to an in-memory or Redis-backed store (configurable via memory config).

**Authentication:**
*   The runtime ships with generic middleware for A2A security: Bearer tokens, or robust OIDC / OAuth 2.0 for inter-agent identities, automatically verified before routing to the agent logic.

## 5. Praesidia integration

Praesidia is deeply etched into the Neuro lifecycle. It acts as the undeniable security plane encapsulating the agent.

**At Build Time:**
Neuro reads `praesidia.policy.yaml`, hashes it, and embeds a digest into the `AgentCard` (as a vendor extension `x-praesidia-policy-hash`). It ensures the agent cannot start if the loaded policy is tampered with.

**At Runtime:**
The Neuro A2A HTTP server mounts **Praesidia Middleware**:
1.  **Ingress Guard:** Before hitting the LLM, the incoming A2A message is sent to the Praesidia local/sidecar API (via gRPC or fast HTTP) for `prompt_injection` and `jailbreak` analysis.
2.  **Egress Guard:** Before SSE chunks or final JSON responses are returned to the caller, they stream through a Praesidia filter interceptor to enforce `pii_leakage` rules.
3.  **Tool Execution Hook:** JIT (Just-In-Time) evaluation. If the agent attempts to call a tool (e.g., `mutate_crm`), Neuro pauses execution, asks Praesidia if the action is allowed under the current session context, and only proceeds if receiving an `ALLOW` signal.

**Schema: `praesidia.policy.yaml`**
```yaml
schema_version: 1.0
enforcement: strict # strict | permissive (log only)
rules:
  ingress:
    - rule: block_jailbreak
      action: reject
  egress:
    - rule: redact_pii
      types: [EMAIL, CREDIT_CARD]
      action: modify
  tools:
    - match: "search-crm"
      action: allow
    - match: "mutate_*"
      require_human_approval: true # Triggers A2A interaction paused state
```

## 6. SDK design (TypeScript)

The TypeScript SDK focuses on a declarative Builder pattern. By separating the HTTP server boilerplate from the agent's logic, developers focus uniquely on intelligence.

```typescript
import { createAgent, Tool } from '@neuro/sdk';
import { PraesidiaHooks } from '@neuro/praesidia';
import { z } from 'zod';

// Tool Definition using standard Zod schema mapping natively to MCP
const scrapeTool = new Tool({
  name: 'scrape-website',
  description: 'Extracts text from a public URL',
  schema: z.object({
    url: z.string().url(),
  }),
  execute: async ({ url }) => {
    const res = await fetch(url);
    return await res.text();
  }
});

const agent = createAgent({
  config: './neuro.agent.yaml', // Automatically parses and links config
  tools: [scrapeTool],
  
  // Custom Instruction Logic
  systemPrompt: (context) => `You are an expert sales analyst for Acme Corp. 
    Current target: ${context.metadata.targetCompany}`,

  // Hooking Praesidia locally
  hooks: [
    PraesidiaHooks.withPolicy('./praesidia.policy.yaml')
  ],

  // Override or intercept A2A message handling natively
  onMessage: async (msg, { llm, tools, stream }) => {
    // 1. Log or modify message
    console.log(`Received task: ${msg.content}`);
    
    // 2. Execute via predefined model config in yaml, stream output backwards
    const response = await llm.execute(msg, { tools });
    for await (const chunk of response) {
      stream.write(chunk);
    }
  }
});

// Starts the A2A compliant server
agent.start();
```

## 7. SDK design (Python)

The Python SDK mirrors the TS developer experience using Pydantic for schemas and FastAPI under the hood for the A2A server.

```python
import asyncio
from neuro_sdk import create_agent, Tool, StreamContext
from neuro_praesidia import PraesidiaHooks
from pydantic import BaseModel, HttpUrl

class ScrapeInput(BaseModel):
    url: HttpUrl

async def scrape_execute(params: ScrapeInput):
    # httpx implementation (omitted for brevity)
    return "Scraped content..."

scrape_tool = Tool(
    name="scrape-website",
    description="Extracts text from a public URL",
    schema=ScrapeInput,
    execute=scrape_execute
)

async def handle_message(msg: dict, ctx: StreamContext):
    print(f"Received task: {msg['content']}")
    
    # Executes the model and streams back A2A compliant SSE
    async for chunk in ctx.llm.stream(msg, tools=[scrape_tool]):
        await ctx.stream.write(chunk)

agent = create_agent(
    config_path="./neuro.agent.yaml",
    tools=[scrape_tool],
    system_prompt="You are an expert sales analyst for Acme Corp.",
    hooks=[
        PraesidiaHooks.with_policy('./praesidia.policy.yaml')
    ],
    on_message=handle_message
)

if __name__ == "__main__":
    agent.start() # Binds to 0.0.0.0:8080 by default
```

## 8. Tech stack decisions

*   **Runtime:** Node.js (with standard V8) for the CLI and TS SDK. *Justification:* Widest ecosystem adoption, native JSON handling, massive talent pool. Python 3.11+ for the Python SDK to leverage native `asyncio` and typing improvements.
*   **HTTP Server Layer:** `Hono` (TypeScript) and `FastAPI` (Python). *Justification:* Both are intensely fast, incredibly lightweight, and have flawless support for SSE and strict typing. They abstract away raw HTTP handling without adding the overhead of Express or Django.
*   **AgentCard / Config Validation:** `Zod` (TypeScript) and `Pydantic` (Python). *Justification:* Industry-standard runtime verification. They can natively compile down to JSON Schema, which is required for the A2A payload metadata.
*   **Packaging / Deployment:** Docker-first. The CLI packages agents using Distroless or Alpine base images. *Justification:* Ensures runtime consistency across any platform (AWS, GCP, self-host) without vendor lock-in.
*   **Testing Framework:** `Vitest` (TS) and `pytest` (Python). *Justification:* Modern, fast, and native async support.
*   **Documentation Site:** `VitePress` or `Fumadocs`. *Justification:* Blazing fast MPA, markdown-centric, elegant out-of-the-box UI fitting the modern developer tool aesthetic.

## 9. Design and branding

**Name:** "Neuro"
*Rationale:* Represents the 'nervous system' or core operational brains of a new agent. It implies synaptic speed, intelligence, and connectivity (connecting networks via A2A).

**Aesthetic Philosophy:** 
Clean, confident, fast, and completely frictionless. It should evoke the same feeling a developer gets when using Vercel or Linear — zero clutter, incredibly tight typography, and immediate "time-to-first-value".

*   **Logo Concept:** A clean, geometric continuous line forming an abstract 'N' that subtly doubles as a node graph or neural connection. No literal brains or robot vectors. High precision geometry.
*   **Typography:** `Inter` or `Geist` for body/docs (legibility, modern crispness). `JetBrains Mono` or `Geist Mono` for all CLI, code snippets, and technical numbers.
*   **Color Palette:**
    *   **Background (Docs/Brand):** Pristine White `#FFFFFF` / Deep Pitch Black `#0A0A0A`
    *   **Primary/Accent:** "Neuro Violet" `#6E56CF` (Trust, intelligence, slightly energetic)
    *   **Action/Success:** "A2A Emerald" `#10B981` (Network connectivity, go, active)
    *   **Warning/Sec:** "Praesidia Amber" `#F59E0B` (Security intervention, policy hits)
    *   **Surface/Borders:** Refined silvers `#E5E7EB` / `#27272A`.
*   **CLI Output:** Highly structured. Uses chalk/ink for beautiful terminal outputs. Success messages are concise. Errors print precise stack traces with "How to fix" suggestions.

## 10. Open-source community strategy

**Differentiation (Positioning):**
*LangGraph/CrewAI/AutoGen* are orchestration heavyweights — they dictate how your agents think, plan, and loop internally.
*Neuro* doesn't care how your agent thinks. It cares about **how your agent is packaged, secured, and communicates**. Neuro is the standard container format and HTTP runtime for the A2A era. We are the 'Docker' of AI agents, not the 'Kubernetes'.

**Repository Structure:**
*   Main branch heavily protected.
*   `discussions` tab enabled for feature ideas and A2A standard translation.
*   `good first issue` heavily tagged for adapters (e.g., adding an Anthropic tool bridge, LangChain middleware).

**Launch Strategy:**
*   **The "Wow" demo:** Go from an empty folder to a working A2A-compliant agent, heavily guarded by Praesidia preventing a prompt injection attack, in under 60 seconds. All recorded in a crisp 1080p `asciinema` or `Raycast` video.
*   Launch on Hacker News, X, and the Linux Foundation A2A discord.

**A 3-Month Roadmap:**
*   **v0.1 (Month 1):** The "Proof of Protocol". TS SDK and CLI complete. Basic A2A `AgentCard` generation, `/message/send` support. Praesidia hooks implemented.
*   **v0.2 (Month 2):** The "Python Expansion". Feature parity achieved in the Python SDK. Streaming SSE stabilized. Support for direct MCP tool ingestion.
*   **v1.0 (Month 3):** The "Network Ready" release. `neuro register` fully operational with major A2A directories. Security audits completed via Praesidia integration. Stable API guarantees.
