import React from 'react';
import { Box, Text } from 'ink';
import { Message, AgentDef } from '../types.js';

interface Props {
  message: Message;
  agents: AgentDef[];
}

export function MessageItem({ message, agents }: Props) {
  if (message.type === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={1}>
          <Text bold color="white">You</Text>
          <Text color="gray">›</Text>
        </Box>
        <Box marginLeft={2}>
          <Text wrap="wrap">{message.content}</Text>
        </Box>
      </Box>
    );
  }

  if (message.type === 'system') {
    return (
      <Box marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor wrap="wrap">{message.content}</Text>
      </Box>
    );
  }

  if (message.type === 'agent' && message.agentId) {
    const agent = agents.find((a) => a.id === message.agentId);
    const color = (agent?.inkColor ?? 'white') as any;
    const display = message.streaming ? message.content + '▌' : message.content;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={1}>
          <Text bold color={color}>{agent?.emoji ?? '🤖'} {agent?.name ?? message.agentId}</Text>
          <Text color="gray">─</Text>
          <Text color="gray" dimColor>{agent?.role ?? 'Agent'}</Text>
          {message.streaming && <Text color="cyan" dimColor>streaming</Text>}
        </Box>
        <Box marginLeft={2}>
          <Text wrap="wrap" color={color}>{display}</Text>
        </Box>
      </Box>
    );
  }

  return null;
}
