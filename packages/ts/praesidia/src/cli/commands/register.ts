import { Command } from 'commander';
import fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { parseAgentConfig, compileToAgentCard } from '../../types.js';

interface RegistrationRecord {
  agentName: string;
  registry: string;
  registeredAt: string;
  agentCardUrl: string;
  raw: unknown;
}

export const registerCommand = new Command('register')
  .description('Publish your AgentCard to an A2A directory registry')
  .option('-c, --config <path>', 'Path to neuro.agent.yaml', 'neuro.agent.yaml')
  .option('-r, --registry <url>', 'A2A registry base URL', 'https://registry.a2a.dev')
  .option('--dry-run', 'Validate and print the AgentCard without publishing')
  .action(async (options: { config: string; registry: string; dryRun?: boolean }) => {
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

    // Check if a built AgentCard exists in dist/
    const distCardPath = path.resolve(process.cwd(), 'dist', '.well-known', 'agent.json');
    let agentCard;
    if (fs.existsSync(distCardPath)) {
      agentCard = await fs.readJson(distCardPath);
      console.log(chalk.dim(`[Neuro] Using built AgentCard from ${distCardPath}`));
    } else {
      agentCard = compileToAgentCard(config);
      console.log(chalk.yellow('[Neuro] No dist/ found — run `neuro build` first for production. Using compiled card.'));
    }

    console.log(chalk.blue(`\n[Neuro] AgentCard for ${chalk.bold(config.name)}:`));
    console.log(chalk.dim(JSON.stringify(agentCard, null, 2)));

    if (options.dryRun) {
      console.log(chalk.cyan('\n[Neuro] Dry run complete. No data was sent.'));
      return;
    }

    const registryUrl = options.registry.replace(/\/$/, '');
    const publishUrl = `${registryUrl}/api/v1/agents/publish`;

    console.log(chalk.blue(`\n[Neuro] Publishing to ${publishUrl}...`));

    let responseData: unknown;
    try {
      const res = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentCard),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Registry returned ${res.status}: ${body}`);
      }

      responseData = await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`\n[Neuro] Registration failed: ${msg}`));
      console.error(chalk.dim('Tip: Use --dry-run to validate your AgentCard without publishing.'));
      process.exit(1);
    }

    // Persist registration locally
    const neuroDir = path.resolve(process.cwd(), '.neuro');
    const registrationPath = path.join(neuroDir, 'registration.json');
    await fs.ensureDir(neuroDir);

    const record: RegistrationRecord = {
      agentName: config.name,
      registry: registryUrl,
      registeredAt: new Date().toISOString(),
      agentCardUrl: `${registryUrl}/agents/${config.name.toLowerCase().replace(/\s+/g, '-')}`,
      raw: responseData,
    };

    await fs.writeJson(registrationPath, record, { spaces: 2 });

    console.log(chalk.green(`\n✓ ${config.name} registered successfully.`));
    console.log(`  Registry: ${chalk.cyan(registryUrl)}`);
    console.log(`  AgentCard: ${chalk.cyan(record.agentCardUrl)}`);
    console.log(chalk.dim(`  Registration saved to ${registrationPath}`));
  });
