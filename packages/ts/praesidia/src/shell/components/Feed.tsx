import React from 'react';
import { Box, Text } from 'ink';
import { Message, AgentDef, AppMode } from '../types.js';
import { MessageItem } from './MessageItem.js';

interface Props {
  messages: Message[];
  agents: AgentDef[];
  width: number;
  mode: AppMode;
  usingDefault: boolean;
}

const MAX_VISIBLE = 18;

export function Feed({ messages, agents, width, mode, usingDefault }: Props) {
  const visible = messages.slice(-MAX_VISIBLE);

  return (
    <Box
      flexDirection="column"
      width={width}
      flexGrow={1}
      paddingX={1}
    >
      {visible.length === 0 && usingDefault ? (
        <Box flexDirection="column" paddingY={1}>
          <Text bold color="magenta">⬡ No config found — using built-in defaults</Text>
          <Text> </Text>
          <Text color="gray">Create a <Text bold color="white">neurogent-shell.yaml</Text> in this directory to define your agents:</Text>
          <Text> </Text>
          <Text color="gray" dimColor>  agents:</Text>
          <Text color="gray" dimColor>    - id: myagent</Text>
          <Text color="gray" dimColor>      name: My Agent</Text>
          <Text color="gray" dimColor>      role: Specialist</Text>
          <Text color="gray" dimColor>      emoji: "🚀"</Text>
          <Text color="gray" dimColor>      color: cyan</Text>
          <Text color="gray" dimColor>      expertise: [keyword1, keyword2]</Text>
          <Text color="gray" dimColor>      system_prompt: "You are..."</Text>
          <Text> </Text>
          <Text color="gray">See <Text color="cyan">examples/</Text> for ready-made configs. Type <Text color="white">/help</Text> for commands.</Text>
        </Box>
      ) : visible.length === 0 ? (
        <Box flexDirection="column" paddingY={1}>
          <Text bold color="magenta">⬡ Ready</Text>
          <Text color="gray">Type a message. Use <Text color="white">@agentname</Text> to mention a specific agent.</Text>
          <Text color="gray">Commands: <Text color="white">/swarm /clear /agents /help</Text></Text>
          {mode === 'swarm' && <Text bold color="yellow">⚡ Swarm mode active — all agents will respond</Text>}
        </Box>
      ) : (
        visible.map((msg) => (
          <MessageItem key={msg.id} message={msg} agents={agents} />
        ))
      )}
    </Box>
  );
}
