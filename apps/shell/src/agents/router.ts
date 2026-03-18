import { AgentId, AgentDef } from '../types.js';

export function extractMentions(input: string, agents: AgentDef[]): AgentId[] {
  const mentionRegex = /@(\S+)/g;
  const agentMap = new Map(agents.map((a) => [a.id.toLowerCase(), a.id]));
  const nameMap = new Map(agents.map((a) => [a.name.toLowerCase(), a.id]));

  const results: AgentId[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(input)) !== null) {
    const term = match[1].toLowerCase();
    const byId = agentMap.get(term);
    const byName = nameMap.get(term);
    if (byId) results.push(byId);
    else if (byName) results.push(byName);
  }

  return [...new Set(results)];
}

export function routeMessage(input: string, agents: AgentDef[]): AgentId[] {
  // 1. @mentions take priority
  const mentions = extractMentions(input, agents);
  if (mentions.length > 0) return mentions;

  // 2. Score each agent by how many of their expertise keywords appear in input
  const lower = input.toLowerCase();
  const scores: Array<[AgentId, number]> = agents.map((agent) => {
    let score = 0;
    for (const kw of agent.expertise) {
      // word boundary match for short keywords, substring for longer ones
      if (kw.length >= 5) {
        if (lower.includes(kw.toLowerCase())) score += 2;
      } else {
        const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`);
        if (regex.test(lower)) score += 3;
      }
    }
    return [agent.id, score] as [AgentId, number];
  });

  const positive = scores.filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);

  if (positive.length === 0) {
    // No match — return first agent (usually the generalist)
    return [agents[0].id];
  }

  // Return top scorer(s) — include ties and near-ties (>= 75% of top)
  const topScore = positive[0][1];
  return positive
    .filter(([, s]) => s >= topScore * 0.75)
    .slice(0, 2)
    .map(([id]) => id);
}
