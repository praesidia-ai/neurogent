import { Command } from 'commander';
import fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initCommand = new Command('init')
  .description('Scaffold a new Neuro agent project')
  .argument('<project-name>', 'Name of the project directory')
  .option('--template <template>', 'Template to use', 'ts-basic')
  .action(async (projectName: string, options) => {
    const targetDir = path.resolve(process.cwd(), projectName);
    // In a monorepo structure running via cli, template is at root/templates
    // We mock path derivation for implementation demo
    const templateDir = path.resolve(__dirname, '../../../templates', options.template);

    console.log(chalk.blue(`[Neuro] Initializing agent ${projectName} using template ${options.template}...`));

    try {
      if (fs.existsSync(targetDir)) {
        console.error(chalk.red(`Error: Directory ${projectName} already exists.`));
        process.exit(1);
      }

      await fs.ensureDir(targetDir);
      
      if (fs.existsSync(templateDir)) {
        await fs.copy(templateDir, targetDir);
      } else {
        // Fallback for execution when not within repo (e.g., tests)
        console.warn(chalk.yellow('Template dir not found, scaffolding bare minimum for demonstration.'));
        await fs.writeFile(path.join(targetDir, 'neuro.agent.yaml'), `name: ${projectName}\\nversion: 1.0.0\\ndescription: An A2A agent\\nauthor: Acme\\nlicense: MIT\\ncapabilities: [\\"chat\\"]\\nmodel:\\n  provider: dummy\\n  name: default`);
        await fs.mkdirp(path.join(targetDir, 'src'));
        await fs.writeFile(path.join(targetDir, 'src/index.ts'), `import { createAgent } from '@neuro/sdk';\\n\\nconst agent = createAgent({ config: './neuro.agent.yaml' });\\nagent.start();\\n`);
        await fs.writeFile(path.join(targetDir, 'package.json'), JSON.stringify({ name: projectName, type: 'module', scripts: { dev: 'tsx src/index.ts' } }, null, 2));
      }

      console.log(chalk.green(`\\nSuccess! Created ${projectName} at ${targetDir}`));
      console.log(`\\nNext steps:\\n  cd ${projectName}\\n  pnpm install\\n  pnpm dev`);
    } catch (err: any) {
      console.error(chalk.red(`Initialization failed: ${err.message}`));
      process.exit(1);
    }
  });
