import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

export const praesidiaPolicySchema = z.object({
  schema_version: z.union([z.number(), z.string()]),
  enforcement: z.enum(['strict', 'permissive']).default('strict'),
  rules: z.object({
    ingress: z.array(z.object({
      rule: z.string(),
      action: z.enum(['reject', 'allow', 'log']),
    })).optional().default([]),

    egress: z.array(z.object({
      rule: z.string(),
      types: z.array(z.string()).optional(),
      action: z.enum(['modify', 'reject', 'allow']),
    })).optional().default([]),

    tools: z.array(z.object({
      match: z.string(),
      action: z.enum(['allow', 'reject']),
      require_human_approval: z.boolean().optional(),
    })).optional().default([]),
  }),
});

export type PraesidiaPolicy = z.infer<typeof praesidiaPolicySchema>;

export function parsePolicy(yamlContent: string): PraesidiaPolicy {
  const raw = parseYaml(yamlContent);
  return praesidiaPolicySchema.parse(raw);
}
