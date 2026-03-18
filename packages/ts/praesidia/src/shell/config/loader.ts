import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ShellYamlSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { ShellConfig, AgentDef, AgentModel } from '../types.js';

// Config search order when no --config flag is provided
const CONFIG_SEARCH_PATHS = [
  'neurogent-shell.yaml',
  'neurogent-shell.yml',
  '.neurogent-shell.yaml',
  '.neurogent-shell.yml',
];

function resolveGlobalPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return path.join(home, '.neuro', 'shell.yaml');
}

function parseYamlConfig(filePath: string): ShellConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const validated = ShellYamlSchema.parse(parsed);

  const globalModel: AgentModel | undefined = validated.model
    ? {
        provider: validated.model.provider,
        name: validated.model.name,
        maxTokens: validated.model.max_tokens,
        temperature: validated.model.temperature,
        baseUrl: validated.model.base_url,
      }
    : undefined;

  const agents: AgentDef[] = validated.agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    emoji: a.emoji,
    inkColor: a.color,
    expertise: a.expertise,
    systemPrompt: a.system_prompt,
    model: a.model
      ? {
          provider: a.model.provider,
          name: a.model.name,
          maxTokens: a.model.max_tokens,
          temperature: a.model.temperature,
          baseUrl: a.model.base_url,
        }
      : undefined,
  }));

  return {
    shellName: validated.shell.name,
    globalModel,
    agents,
  };
}

export interface LoadResult {
  config: ShellConfig;
  configPath: string | null;
  usingDefault: boolean;
}

export function loadConfig(explicitPath?: string): LoadResult {
  // 1. Explicit --config path
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    return { config: parseYamlConfig(resolved), configPath: resolved, usingDefault: false };
  }

  // 2. Search cwd
  for (const name of CONFIG_SEARCH_PATHS) {
    const resolved = path.resolve(name);
    if (fs.existsSync(resolved)) {
      return { config: parseYamlConfig(resolved), configPath: resolved, usingDefault: false };
    }
  }

  // 3. Global ~/.neuro/shell.yaml
  const globalPath = resolveGlobalPath();
  if (fs.existsSync(globalPath)) {
    return { config: parseYamlConfig(globalPath), configPath: globalPath, usingDefault: false };
  }

  // 4. Built-in default
  return { config: DEFAULT_CONFIG, configPath: null, usingDefault: true };
}
