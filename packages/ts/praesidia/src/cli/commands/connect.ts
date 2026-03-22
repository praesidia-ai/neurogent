/**
 * neurogent connect — point the shell at a remote ZeroClaw instance.
 *
 * Writes the URL to .neurogent/runtime.json so the shell automatically
 * routes messages through the remote agent instead of calling the LLM directly.
 *
 * Usage:
 *   neurogent connect --url http://my-server:4100 --agent engineer
 *   neurogent connect --url http://my-server:4100   # connects all agents at that host
 *   neurogent connect --clear                       # remove remote connection
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadRuntime, saveRuntime, clearRuntime, pingAgent } from '../../zeroclaw/client.js';

export const connectCommand = new Command('connect')
  .description('Connect the shell to a remote ZeroClaw agent server')
  .option('-u, --url <url>', 'Base URL of the ZeroClaw server (e.g. http://my-server:4100)')
  .option('-a, --agent <id>', 'Agent ID to connect (default: connect to all)')
  .option('--clear', 'Remove the remote connection and fall back to local LLM')
  .action(async (opts: { url?: string; agent?: string; clear?: boolean }) => {

    if (opts.clear) {
      clearRuntime();
      console.log(chalk.yellow('  Remote connection cleared. Shell will use local LLM.\n'));
      return;
    }

    if (!opts.url) {
      console.error(chalk.red('  Error: --url is required\n'));
      console.log(chalk.gray('  Example: neurogent connect --url http://my-server:4100\n'));
      process.exit(1);
    }

    const url = opts.url.replace(/\/$/, '');

    console.log(chalk.magenta('\n  Checking connection...\n'));
    const health = await pingAgent(url);

    if (!health.alive) {
      console.error(chalk.red(`  Cannot reach ${url}: ${health.error}`));
      console.log(chalk.gray('  Make sure the remote server is running: neurogent start\n'));
      process.exit(1);
    }

    console.log(chalk.green(`  Connected to: ${health.agent ?? 'ZeroClaw'} (uptime ${health.uptime}s)`));

    // Load or init runtime
    const runtime = loadRuntime() ?? { agents: [], startedAt: new Date().toISOString() };

    if (opts.agent) {
      // Connect a specific agent
      const existing = runtime.agents.find(a => a.id === opts.agent);
      if (existing) {
        existing.url = url;
      } else {
        runtime.agents.push({
          id: opts.agent,
          name: opts.agent,
          url,
          port: parseInt(new URL(url).port || '80', 10),
          startedAt: new Date().toISOString(),
        });
      }
      console.log(chalk.cyan(`\n  Agent "${opts.agent}" → ${url}`));
    } else {
      // Register as a wildcard entry (shell will use this for any unmatched agent)
      const wildcardIdx = runtime.agents.findIndex(a => a.id === '*');
      const entry = {
        id: '*',
        name: 'remote',
        url,
        port: parseInt(new URL(url).port || '80', 10),
        startedAt: new Date().toISOString(),
      };
      if (wildcardIdx >= 0) {
        runtime.agents[wildcardIdx] = entry;
      } else {
        runtime.agents.unshift(entry);
      }
      console.log(chalk.cyan(`\n  All agents → ${url}`));
    }

    saveRuntime(runtime);
    console.log(chalk.gray('  Saved to .neurogent/runtime.json'));
    console.log(chalk.magenta('\n  Launch the shell to use the remote backend:\n'));
    console.log(chalk.white('  neurogent shell\n'));
  });
