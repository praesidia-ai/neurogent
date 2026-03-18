/**
 * Pack installer — downloads community agent configs from GitHub.
 * Registry lives at: https://raw.githubusercontent.com/neurosdk/neuro-shell/main/registry/index.yaml
 * For now, we ship built-in packs as named aliases pointing to the examples/ directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

// Built-in pack aliases (file paths relative to the package's examples/ dir)
// In a real release these would point to GitHub raw URLs
export const BUILTIN_PACKS: Record<string, string> = {
  'full-team':       'full-team.yaml',
  'dev-trio':        'dev-trio.yaml',
  'solo-researcher': 'solo-researcher.yaml',
};

export interface PackInfo {
  name: string;
  description: string;
  agentCount: number;
  source: 'builtin';
}

export function listBuiltinPacks(): PackInfo[] {
  return [
    { name: 'full-team',       description: '10 specialized agents: coder, cloud, researcher, writer, security, data, marketer, devops, PM, support', agentCount: 10, source: 'builtin' },
    { name: 'dev-trio',        description: '3-agent engineering team: full-stack engineer, security specialist, code reviewer', agentCount: 3, source: 'builtin' },
    { name: 'solo-researcher', description: 'Single deep research agent for exploration and analysis sessions', agentCount: 1, source: 'builtin' },
  ];
}

export function installPack(packName: string, targetDir: string = '.'): string {
  const filename = BUILTIN_PACKS[packName];
  if (!filename) {
    const available = Object.keys(BUILTIN_PACKS).join(', ');
    throw new Error(`Unknown pack "${packName}". Available: ${available}`);
  }

  // Find the examples directory relative to this package.
  // Works both in dev (src/) and built (dist/)
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(__dirname, '..', '..');
  const sourcePath = path.join(packageRoot, 'examples', filename);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Pack file not found: ${sourcePath}`);
  }

  const destPath = path.resolve(targetDir, 'neuro-shell.yaml');
  const content = fs.readFileSync(sourcePath, 'utf-8');
  fs.writeFileSync(destPath, content, 'utf-8');
  return destPath;
}
