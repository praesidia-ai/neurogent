import { AgentHook, HookResult } from '../types.js';
import { PraesidiaPolicy, parsePolicy } from './policy.js';
import * as crypto from 'crypto';
import * as fs from 'fs';

export class PraesidiaHooks implements AgentHook {
  private policy: PraesidiaPolicy | null = null;
  private isPermissive: boolean = false;

  constructor(policy?: PraesidiaPolicy) {
    if (policy) {
      this.policy = policy;
      this.isPermissive = policy.enforcement === 'permissive';
    }
  }

  static withPolicy(filePath: string): PraesidiaHooks {
    if (!fs.existsSync(filePath)) {
      console.warn(`[Praesidia] Policy file not found at ${filePath}. Running with empty policy.`);
      return new PraesidiaHooks();
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const policy = parsePolicy(content);
    return new PraesidiaHooks(policy);
  }

  getPolicyHash(): string {
    if (!this.policy) return '';
    return crypto.createHash('sha256').update(JSON.stringify(this.policy)).digest('hex');
  }

  async checkIngress(payload: string): Promise<HookResult> {
    if (!this.policy?.rules.ingress.length) return { allowed: true };

    const jailbreakPatterns = [
      'ignore all previous instructions',
      'disregard your instructions',
      'you are now',
      'act as if',
      'pretend you are',
    ];

    const lower = payload.toLowerCase();
    const triggered = jailbreakPatterns.some(p => lower.includes(p));

    if (triggered) {
      const rejectRule = this.policy.rules.ingress.find(r => r.action === 'reject');
      if (rejectRule && !this.isPermissive) {
        return { allowed: false, reason: `Blocked by rule: ${rejectRule.rule}` };
      }
    }

    return { allowed: true };
  }

  async checkEgress(chunk: string): Promise<HookResult> {
    if (!this.policy?.rules.egress.length) return { allowed: true, modifiedPayload: chunk };

    let modified = chunk;
    for (const rule of this.policy.rules.egress) {
      if (rule.rule === 'redact_pii' && rule.action === 'modify') {
        // Credit cards
        modified = modified.replace(/\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b/g, '[REDACTED-CC]');
        // SSNs
        modified = modified.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]');
        // Email addresses
        if (rule.types?.includes('EMAIL')) {
          modified = modified.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[REDACTED-EMAIL]');
        }
      }
    }

    return { allowed: true, modifiedPayload: modified };
  }

  async checkTool(toolName: string): Promise<HookResult> {
    if (!this.policy?.rules.tools.length) return { allowed: true };

    for (const rule of this.policy.rules.tools) {
      const isMatch = rule.match.endsWith('*')
        ? toolName.startsWith(rule.match.slice(0, -1))
        : toolName === rule.match;

      if (isMatch) {
        if (rule.action === 'reject' && !this.isPermissive) {
          return { allowed: false, reason: `Tool blocked by policy rule: ${rule.match}` };
        }
        if (rule.require_human_approval) {
          return { allowed: false, reason: 'HUMAN_APPROVAL_REQUIRED' };
        }
        return { allowed: true };
      }
    }

    return { allowed: true };
  }
}
