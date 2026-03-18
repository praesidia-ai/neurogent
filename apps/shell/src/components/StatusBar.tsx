import React from 'react';
import { Box, Text } from 'ink';
import { AppMode } from '../types.js';

interface Props {
  mode: AppMode;
  agentCount: number;
  width?: number;
}

export function StatusBar({ mode, agentCount, width }: Props) {
  return (
    <Box flexDirection="row" justifyContent="space-between" paddingX={1} width={width}>
      <Box gap={2}>
        <Text color="gray" dimColor>@agent</Text>
        <Text color="gray" dimColor>/swarm</Text>
        <Text color="gray" dimColor>/clear</Text>
        <Text color="gray" dimColor>/agents</Text>
        <Text color="gray" dimColor>/help</Text>
      </Box>
      <Box gap={2}>
        <Text color={mode === 'swarm' ? 'yellow' : 'gray'} dimColor={mode !== 'swarm'}>
          {mode === 'swarm' ? `⚡ swarm (${agentCount} agents)` : 'normal'}
        </Text>
        <Text color="gray" dimColor>ESC quit</Text>
      </Box>
    </Box>
  );
}
