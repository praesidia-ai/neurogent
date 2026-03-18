import React from 'react';
import { Box, Text } from 'ink';
import { AgentDef, AgentId } from '../types.js';

interface Props {
  agents: AgentDef[];
  activeAgents: Set<AgentId>;
  width: number;
}

export function AgentList({ agents, activeAgents, width }: Props) {
  return (
    <Box
      flexDirection="column"
      width={width}
      paddingLeft={1}
      paddingRight={1}
    >
      <Text bold color="gray" dimColor>AGENTS</Text>
      <Box height={1} />
      {agents.map((agent) => {
        const active = activeAgents.has(agent.id);
        return (
          <Box key={agent.id} flexDirection="column" marginBottom={1}>
            <Box gap={1}>
              <Text color={active ? 'green' : 'gray'}>{active ? '●' : '○'}</Text>
              <Text bold color={active ? (agent.inkColor as any) : 'white'}>
                {agent.emoji} {agent.name}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray" dimColor>
                {agent.role}{active ? ' ▸' : ''}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
