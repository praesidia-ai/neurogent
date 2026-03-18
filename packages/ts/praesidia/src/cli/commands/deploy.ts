import { Command } from 'commander';
import fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { parseAgentConfig } from '../../types.js';

export const deployCommand = new Command('deploy')
  .description('Generate production Docker artifacts for your Neuro agent')
  .option('-c, --config <path>', 'Path to neuro.agent.yaml', 'neuro.agent.yaml')
  .option('-p, --port <port>', 'Port the agent listens on', '8080')
  .option('--compose', 'Also generate a docker-compose.yml')
  .action(async (options: { config: string; port: string; compose?: boolean }) => {
    const configPath = path.resolve(process.cwd(), options.config);

    if (!fs.existsSync(configPath)) {
      console.error(chalk.red(`Error: config not found at ${configPath}`));
      process.exit(1);
    }

    let config;
    try {
      const rawYaml = await fs.readFile(configPath, 'utf-8');
      config = parseAgentConfig(rawYaml);
    } catch (err: unknown) {
      console.error(chalk.red(`Failed to parse config: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }

    const imageName = config.name.toLowerCase().replace(/\s+/g, '-');
    const port = options.port;

    // ─── Dockerfile (multi-stage) ────────────────────────────────────────────
    const dockerfile = `# syntax=docker/dockerfile:1
# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json ./
COPY src ./src
COPY neuro.agent.yaml ./

RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=${port}

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY neuro.agent.yaml ./

EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \\
  CMD wget -qO- http://localhost:${port}/.well-known/agent.json || exit 1

CMD ["node", "dist/index.js"]
`;

    // ─── .dockerignore ───────────────────────────────────────────────────────
    const dockerignore = `node_modules
dist
.neuro
*.log
.env
.env.*
!.env.example
.git
.gitignore
README.md
`;

    // ─── docker-compose.yml ──────────────────────────────────────────────────
    const compose = `services:
  ${imageName}:
    build: .
    image: ${imageName}:latest
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=production
      - PORT=${port}
      # Add your provider key:
      # - OPENAI_API_KEY=\${OPENAI_API_KEY}
      # - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:${port}/.well-known/agent.json"]
      interval: 30s
      timeout: 5s
      retries: 3
`;

    const cwd = process.cwd();

    await fs.writeFile(path.join(cwd, 'Dockerfile'), dockerfile);
    console.log(chalk.green(`✓ Dockerfile`));

    await fs.writeFile(path.join(cwd, '.dockerignore'), dockerignore);
    console.log(chalk.green(`✓ .dockerignore`));

    if (options.compose) {
      await fs.writeFile(path.join(cwd, 'docker-compose.yml'), compose);
      console.log(chalk.green(`✓ docker-compose.yml`));
    }

    console.log(chalk.blue(`\n[Neuro] Artifacts generated for ${chalk.bold(config.name)} v${config.version}\n`));
    console.log('Build and run:');
    console.log(chalk.dim(`  docker build -t ${imageName} .`));
    console.log(chalk.dim(`  docker run -p ${port}:${port} -e OPENAI_API_KEY=sk-... ${imageName}`));

    if (options.compose) {
      console.log('\nOr with Compose:');
      console.log(chalk.dim(`  docker compose up --build`));
    }
  });
