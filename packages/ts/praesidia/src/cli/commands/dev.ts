import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export const devCommand = new Command('dev')
  .description('Start local A2A server with hot reload')
  .option('--port <port>', 'Port to listen on', '8080')
  .action(async (options) => {
    console.log(chalk.blue(`[Neuro] Starting dev server on port ${options.port}...`));

    const entryPath = path.resolve(process.cwd(), 'src/index.ts');
    if (!fs.existsSync(entryPath)) {
      console.error(chalk.red(`Error: entry file not found at ${entryPath}`));
      process.exit(1);
    }

    // Use tsx or ts-node-dev for hot reloading
    // In actual implementation we might bundle a runner or spawn node with tsx
    const runner = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: options.port }
    });

    runner.on('close', (code) => {
      console.log(chalk.yellow(`[Neuro] Dev server exited with code ${code}`));
    });
  });
