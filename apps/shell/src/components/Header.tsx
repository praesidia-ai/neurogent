import React from 'react';
import { Box, Text } from 'ink';
import { AppMode } from '../types.js';

interface Props {
  shellName: string;
  activeCount: number;
  totalCount: number;
  mode: AppMode;
  provider: string;
  configPath: string | null;
  width?: number;
}

export function Header({ shellName, activeCount, totalCount, mode, provider, configPath, width }: Props) {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderColor={mode === 'swarm' ? 'yellow' : 'magenta'}
      paddingX={1}
      width={width}
    >
      <Box gap={1}>
        <Text bold color="magenta">⬡</Text>
        <Text bold color="white">{shellName}</Text>
        {configPath && (
          <Text color="gray" dimColor>
            {`(${configPath.split('/').pop()})`}
          </Text>
        )}
      </Box>
      <Box gap={2}>
        {mode === 'swarm' && (
          <Text bold color="yellow">⚡ SWARM</Text>
        )}
        {activeCount > 0 && (
          <Text color="cyan">▸ {activeCount} thinking...</Text>
        )}
        <Text color={activeCount > 0 ? 'green' : 'gray'}>
          ● {totalCount} agent{totalCount !== 1 ? 's' : ''}
        </Text>
        <Text color="gray" dimColor>{provider}</Text>
      </Box>
    </Box>
  );
}
