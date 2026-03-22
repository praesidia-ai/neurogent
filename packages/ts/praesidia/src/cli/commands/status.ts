/**
 * neurogent status — health-check all registered ZeroClaw agents.
 *
 * Reads .neurogent/runtime.json and pings each agent's /health endpoint.
 *
 * Usage:
 *   neurogent status
 *   neurogent status --watch   # refresh every 3 seconds
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadRuntime, pingAgent } from '../../zeroclaw/client.js';

async function printStatus(): Promise<void> {
  const runtime = loadRuntime();

  if (!runtime || runtime.agents.length === 0) {
    console.log(chalk.yellow('\n  No agents registered.\n'));
    console.log(chalk.gray('  Start agents:   neurogent start --config <file>'));
    console.log(chalk.gray('  Connect remote: neurogent connect --url <url>\n'));
    return;
  }

  console.log(chalk.magenta('\n  Neurogent Agent Status\n'));
  console.log(
    chalk.gray('  ' + 'AGENT'.padEnd(16) + 'URL'.padEnd(28) + 'STATUS'.padEnd(10) + 'UPTIME')
  );
  console.log(chalk.gray('  ' + '─'.repeat(64)));

  const checks = runtime.agents.map(async (agent) => {
    const health = await pingAgent(agent.url);
    const status = health.alive
      ? chalk.green('● online')
      : chalk.red('○ offline');
    const uptime = health.alive && health.uptime !== undefined
      ? chalk.gray(`${health.uptime}s`)
      : chalk.gray('—');
    const name = agent.id === '*' ? chalk.gray('(wildcard)') : chalk.white(agent.name);

    console.log(
      `  ${'🤖 ' + (agent.id === '*' ? '*'.padEnd(13) : agent.name.padEnd(13))}` +
      `${chalk.cyan(agent.url.padEnd(28))}` +
      `${status.padEnd(10)}` +
      uptime
    );
  });

  await Promise.all(checks);

  const started = new Date(runtime.startedAt).toLocaleTimeString();
  console.log(chalk.gray(`\n  Runtime started at ${started}\n`));
}

export const statusCommand = new Command('status')
  .description('Show health status of all registered ZeroClaw agents')
  .option('-w, --watch', 'Refresh every 3 seconds')
  .action(async (opts: { watch?: boolean }) => {
    await printStatus();

    if (opts.watch) {
      const interval = setInterval(async () => {
        // Clear the last block of lines (rough terminal clear)
        process.stdout.write('\x1B[2J\x1B[0f');
        await printStatus();
      }, 3_000);
      process.on('SIGINT', () => { clearInterval(interval); process.exit(0); });
      await new Promise(() => {});
    }
  });
