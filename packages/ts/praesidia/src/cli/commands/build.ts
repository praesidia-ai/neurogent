import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import chalk from 'chalk';
import { parseAgentConfig, compileToAgentCard } from '../../types.js';

export const buildCommand = new Command('build')
  .description('Validate config and generate AgentCard')
  .option('--out-dir <dir>', 'Output directory', 'dist')
  .action(async (options) => {
    console.log(chalk.blue('[Neuro] Building AgentCard...'));
    const configPath = path.resolve(process.cwd(), 'neuro.agent.yaml');

    if (!fs.existsSync(configPath)) {
      console.error(chalk.red(`Error: Could not find neuro.agent.yaml at ${configPath}`));
      process.exit(1);
    }

    try {
      const rawYaml = await fs.readFile(configPath, 'utf-8');
      const config = parseAgentConfig(rawYaml);

      // Hash a security policy file if present (any *.policy.yaml in cwd)
      let policyHash: string | undefined;
      const policyPath = path.resolve(process.cwd(), 'praesidia.policy.yaml');
      if (fs.existsSync(policyPath)) {
        const policyContent = await fs.readFile(policyPath, 'utf-8');
        policyHash = crypto.createHash('sha256').update(policyContent).digest('hex');
        console.log(chalk.dim(`[Neuro] Policy hash (sha256): ${policyHash}`));
      }

      const agentCard = compileToAgentCard(config, policyHash);

      const outDir = path.resolve(process.cwd(), options.outDir);
      await fs.ensureDir(path.join(outDir, '.well-known'));

      const outPath = path.join(outDir, '.well-known', 'agent.json');
      await fs.writeFile(outPath, JSON.stringify(agentCard, null, 2));

      console.log(chalk.green(`\n✓ AgentCard → ${outPath}`));
      console.log(chalk.dim(`  name: ${config.name}  version: ${config.version}  capabilities: ${config.capabilities.join(', ')}`));
    } catch (err: unknown) {
      console.error(chalk.red(`Build failed: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });
