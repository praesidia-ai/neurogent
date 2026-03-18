#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { loadConfig } from './config/loader.js';
import { installPack, listBuiltinPacks } from './packs/installer.js';

const args = process.argv.slice(2);
const subcommand = args[0];

// ── neuro-shell packs ────────────────────────────────────────────────────────
if (subcommand === 'packs') {
  const packs = listBuiltinPacks();
  console.log('\nAvailable built-in packs:\n');
  for (const pack of packs) {
    console.log(`  ${pack.name}`);
    console.log(`    ${pack.description}`);
    console.log(`    Agents: ${pack.agentCount}  |  Source: ${pack.source}\n`);
  }
  console.log('Install a pack:  neuro-shell install <pack-name>\n');
  process.exit(0);
}

// ── neuro-shell install <pack-name> ──────────────────────────────────────────
if (subcommand === 'install') {
  const packName = args[1];
  if (!packName) {
    console.error('Usage: neuro-shell install <pack-name>');
    console.error('Run `neuro-shell packs` to see available packs.');
    process.exit(1);
  }
  try {
    const destPath = installPack(packName, process.cwd());
    console.log(`\n✓ Pack "${packName}" installed to ${destPath}`);
    console.log(`\nStart your session:\n  neuro-shell --config ${destPath}\n`);
    process.exit(0);
  } catch (err: unknown) {
    console.error(`❌ Install failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ── Normal shell startup ─────────────────────────────────────────────────────

// Parse --config flag
const configFlagIdx = args.findIndex((a) => a === '--config' || a === '-c');
const explicitConfig = configFlagIdx !== -1 ? args[configFlagIdx + 1] : undefined;

let loadResult: Awaited<ReturnType<typeof loadConfig>>;
try {
  loadResult = loadConfig(explicitConfig);
} catch (err: unknown) {
  console.error('❌ Config error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

// Immersive full-screen experience via alternate screen buffer
process.stdout.write('\x1b[?1049h');
process.stdout.write('\x1b[?25l');

const restore = () => {
  process.stdout.write('\x1b[?25h');
  process.stdout.write('\x1b[?1049l');
};

process.on('exit', restore);
process.on('SIGTERM', () => { restore(); process.exit(0); });
process.on('SIGINT', () => { restore(); process.exit(0); });

const { waitUntilExit } = render(
  <App
    config={loadResult.config}
    configPath={loadResult.configPath}
    usingDefault={loadResult.usingDefault}
  />,
  { exitOnCtrlC: false, patchConsole: true },
);

await waitUntilExit();
restore();
