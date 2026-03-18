#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { deployCommand } from './commands/deploy.js';
import { registerCommand } from './commands/register.js';

const program = new Command();

program
  .name('neurogent')
  .description('A CLI for creating and managing A2A compliant Neuro agents')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(buildCommand);
program.addCommand(deployCommand);
program.addCommand(registerCommand);

program.parse(process.argv);
