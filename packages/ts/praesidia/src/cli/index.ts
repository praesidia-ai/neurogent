#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { deployCommand } from './commands/deploy.js';
import { registerCommand } from './commands/register.js';
import { startCommand } from './commands/start.js';
import { connectCommand } from './commands/connect.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('neurogent')
  .description('A CLI for creating and managing A2A compliant Neuro agents')
  .version('0.3.0');

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(buildCommand);
program.addCommand(deployCommand);
program.addCommand(registerCommand);
program.addCommand(startCommand);
program.addCommand(connectCommand);
program.addCommand(statusCommand);

program.parse(process.argv);
