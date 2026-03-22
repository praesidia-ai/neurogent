/**
 * neurogent start — launch persistent ZeroClaw agent servers from a config file.
 *
 * Each agent gets its own Hono HTTP server on port 4100+N.
 * Ports and PIDs are saved to .neurogent/runtime.json for the shell to pick up.
 *
 * Usage:
 *   neurogent start                           # uses nearest YAML config
 *   neurogent start --config marketing.yaml   # explicit config
 *   neurogent start --base-port 5000          # start ports from 5000
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { createAgentServer } from '../../zeroclaw/runtime.js';
import { saveRuntime, clearRuntime } from '../../zeroclaw/client.js';
import { ShellYamlSchema } from '../../shell/config/schema.js';
import type { AgentDef, AgentModel } from '../../shell/types.js';

const CONFIG_SEARCH = ['neurogent-shell.yaml', 'neurogent-shell.yml', '.neurogent-shell.yaml'];

function findConfig(explicit?: string): string {
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (!fs.existsSync(resolved)) throw new Error(`Config not found: ${resolved}`);
    return resolved;
  }
  for (const name of CONFIG_SEARCH) {
    const resolved = path.resolve(name);
    if (fs.existsSync(resolved)) return resolved;
  }
  throw new Error('No config found. Use --config <file> or create neurogent-shell.yaml');
}

export const startCommand = new Command('start')
  .description('Start persistent ZeroClaw agent servers from a config file')
  .option('-c, --config <path>', 'Path to YAML config file')
  .option('-p, --base-port <number>', 'Starting port (default: 4100)', '4100')
  .action(async (opts: { config?: string; basePort: string }) => {
    const basePort = parseInt(opts.basePort, 10);

    let configPath: string;
    try {
      configPath = findConfig(opts.config);
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }

    const raw = yaml.load(fs.readFileSync(configPath, 'utf-8'));
    const validated = ShellYamlSchema.parse(raw);

    const globalModel: AgentModel | undefined = validated.model
      ? {
          provider: validated.model.provider,
          name: validated.model.name,
          maxTokens: validated.model.max_tokens,
          temperature: validated.model.temperature,
          baseUrl: validated.model.base_url,
        }
      : undefined;

    const agents: AgentDef[] = validated.agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      emoji: a.emoji,
      inkColor: a.color,
      expertise: a.expertise,
      systemPrompt: a.system_prompt,
      model: a.model
        ? {
            provider: a.model.provider,
            name: a.model.name,
            maxTokens: a.model.max_tokens,
            temperature: a.model.temperature,
            baseUrl: a.model.base_url,
          }
        : undefined,
    }));

    console.log(chalk.magenta('\n  Neurogent ZeroClaw Runtime\n'));
    console.log(chalk.gray(`  Config : ${configPath}`));
    console.log(chalk.gray(`  Agents : ${agents.length}\n`));

    // Clear previous runtime
    clearRuntime();

    const servers: ReturnType<typeof createAgentServer>[] = [];
    const registration: Parameters<typeof saveRuntime>[0] = {
      agents: [],
      startedAt: new Date().toISOString(),
    };

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const port = basePort + i;
      const server = createAgentServer(agent, port, globalModel);
      servers.push(server);

      try {
        const instance = await server.start();
        registration.agents.push({
          id: agent.id,
          name: agent.name,
          url: instance.url,
          port,
          pid: process.pid,
          startedAt: instance.startedAt,
        });
        console.log(
          chalk.green('  ✓') +
          chalk.white(` ${agent.emoji} ${agent.name.padEnd(14)}`) +
          chalk.gray(` → `) +
          chalk.cyan(`http://localhost:${port}`)
        );
      } catch (err) {
        console.error(chalk.red(`  ✗ ${agent.name}: ${(err as Error).message}`));
      }
    }

    // Save runtime so shell and status command can find agents
    saveRuntime(registration);

    console.log(chalk.gray('\n  Runtime saved to .neurogent/runtime.json'));
    console.log(chalk.magenta('\n  Agents are live. Press Ctrl+C to stop.\n'));

    // Graceful shutdown
    const stop = () => {
      console.log(chalk.yellow('\n  Stopping agents...'));
      servers.forEach(s => s.stop());
      clearRuntime();
      console.log(chalk.gray('  Runtime cleared. Goodbye.\n'));
      process.exit(0);
    };

    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);

    // Keep alive
    await new Promise(() => {});
  });
