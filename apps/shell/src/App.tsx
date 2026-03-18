import React, { useReducer, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import * as fs from 'fs';
import * as path from 'path';
import { Header } from './components/Header.js';
import { AgentList } from './components/AgentList.js';
import { Feed } from './components/Feed.js';
import { StatusBar } from './components/StatusBar.js';
import { routeMessage } from './agents/router.js';
import { executeAgent, getEffectiveModel } from './agents/executor.js';
import { Message, AgentId, AppMode, HistoryItem, ShellConfig } from './types.js';

// ── State ────────────────────────────────────────────────────────────────────

interface State {
  messages: Message[];
  activeAgents: Set<AgentId>;
  mode: AppMode;
}

type Action =
  | { type: 'ADD'; msg: Message }
  | { type: 'UPDATE'; id: string; content: string; done: boolean }
  | { type: 'AGENT_ON'; id: AgentId }
  | { type: 'AGENT_OFF'; id: AgentId }
  | { type: 'SET_MODE'; mode: AppMode }
  | { type: 'CLEAR' };

function init(): State {
  return { messages: [], activeAgents: new Set(), mode: 'normal' };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD':
      return { ...state, messages: [...state.messages.slice(-100), action.msg] };
    case 'UPDATE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id
            ? { ...m, content: action.content, streaming: !action.done }
            : m,
        ),
      };
    case 'AGENT_ON': {
      const s = new Set(state.activeAgents);
      s.add(action.id);
      return { ...state, activeAgents: s };
    }
    case 'AGENT_OFF': {
      const s = new Set(state.activeAgents);
      s.delete(action.id);
      return { ...state, activeAgents: s };
    }
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'CLEAR':
      return { ...state, messages: [] };
    default:
      return state;
  }
}

// ── App ──────────────────────────────────────────────────────────────────────

interface AppProps {
  config: ShellConfig;
  configPath: string | null;
  usingDefault: boolean;
}

export function App({ config, configPath, usingDefault }: AppProps) {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const [inputValue, setInputValue] = React.useState('');
  const historyRef = useRef<HistoryItem[]>([]);
  const modeRef = useRef<AppMode>('normal');
  const stateRef = useRef<State>(state);

  React.useEffect(() => { modeRef.current = state.mode; }, [state.mode]);
  React.useEffect(() => { stateRef.current = state; }, [state]);

  useInput((_ch, key) => {
    if (key.escape || (key.ctrl && _ch === 'c')) exit();
  });

  const addSystem = useCallback((content: string) => {
    dispatch({
      type: 'ADD',
      msg: { id: crypto.randomUUID(), type: 'system', content, streaming: false, timestamp: Date.now() },
    });
  }, []);

  const streamFromAgent = useCallback((agentId: AgentId, userMessage: string) => {
    const msgId = crypto.randomUUID();
    const agent = config.agents.find((a) => a.id === agentId);
    if (!agent) return;

    dispatch({ type: 'ADD', msg: { id: msgId, type: 'agent', agentId, content: '', streaming: true, timestamp: Date.now() } });
    dispatch({ type: 'AGENT_ON', id: agentId });

    void (async () => {
      let text = '';
      try {
        for await (const chunk of executeAgent(agent, userMessage, historyRef.current, config.globalModel)) {
          text += chunk;
          dispatch({ type: 'UPDATE', id: msgId, content: text, done: false });
        }
      } catch (err: unknown) {
        text += `\n⚠ ${err instanceof Error ? err.message : String(err)}`;
      } finally {
        dispatch({ type: 'UPDATE', id: msgId, content: text, done: true });
        dispatch({ type: 'AGENT_OFF', id: agentId });
        historyRef.current = [...historyRef.current.slice(-20), { role: 'assistant', content: text }];
      }
    })();
  }, [config]);

  // Returns the full response text (used by chain mode)
  const streamFromAgentAsync = useCallback((agentId: AgentId, userMessage: string): Promise<string> => {
    const msgId = crypto.randomUUID();
    const agent = config.agents.find((a) => a.id === agentId);
    if (!agent) return Promise.resolve('');

    dispatch({ type: 'ADD', msg: { id: msgId, type: 'agent', agentId, content: '', streaming: true, timestamp: Date.now() } });
    dispatch({ type: 'AGENT_ON', id: agentId });

    return (async () => {
      let text = '';
      try {
        for await (const chunk of executeAgent(agent, userMessage, historyRef.current, config.globalModel)) {
          text += chunk;
          dispatch({ type: 'UPDATE', id: msgId, content: text, done: false });
        }
      } catch (err: unknown) {
        text += `\n⚠ ${err instanceof Error ? err.message : String(err)}`;
      } finally {
        dispatch({ type: 'UPDATE', id: msgId, content: text, done: true });
        dispatch({ type: 'AGENT_OFF', id: agentId });
        historyRef.current = [...historyRef.current.slice(-20), { role: 'assistant', content: text }];
      }
      return text;
    })();
  }, [config]);

  const handleCommand = useCallback((cmd: string) => {
    const [base] = cmd.trim().toLowerCase().split(/\s+/);
    switch (base) {
      case '/clear': dispatch({ type: 'CLEAR' }); break;
      case '/swarm': {
        const next: AppMode = modeRef.current === 'swarm' ? 'normal' : 'swarm';
        dispatch({ type: 'SET_MODE', mode: next });
        addSystem(next === 'swarm'
          ? `⚡ Swarm mode ON — all ${config.agents.length} agents will respond`
          : '✓ Swarm mode OFF — smart routing restored');
        break;
      }
      case '/agents':
        addSystem(config.agents.map((a) => `${a.emoji} ${a.name} (${a.role}) — ${a.expertise.slice(0, 4).join(', ')}`).join('\n'));
        break;
      case '/export': {
        const msgs = stateRef.current.messages;
        if (msgs.length === 0) {
          addSystem('Nothing to export — conversation is empty.');
          break;
        }
        const now = new Date();
        const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `neuro-session-${ts}.md`;
        const exportPath = path.resolve(process.cwd(), filename);
        const configLabel = configPath ? path.basename(configPath) : 'built-in default';
        const dateLabel = now.toISOString().replace('T', ' ').slice(0, 19);
        const lines: string[] = [
          '# Neuro Shell Session',
          `*Exported: ${dateLabel}*`,
          `*Config: ${configLabel}*`,
          '',
        ];
        for (const msg of msgs) {
          if (msg.type === 'user') {
            lines.push('---', '', `**You:** ${msg.content}`, '');
          } else if (msg.type === 'agent') {
            const agent = config.agents.find((a) => a.id === msg.agentId);
            const label = agent ? `${agent.emoji} ${agent.name} (${agent.role})` : msg.agentId ?? 'Agent';
            lines.push('---', '', `**${label}:**`, msg.content, '');
          } else {
            lines.push('---', '', `*${msg.content}*`, '');
          }
        }
        lines.push('---');
        try {
          fs.writeFileSync(exportPath, lines.join('\n'), 'utf-8');
          addSystem(`✓ Session exported to ${exportPath}`);
        } catch (err: unknown) {
          addSystem(`⚠ Export failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        break;
      }
      case '/help':
        addSystem([
          'Commands:  /swarm  /clear  /agents  /export  /help',
          'Chain:     @nova >> @orion  (pipe response between agents)',
          `Mentions:  ${config.agents.map((a) => `@${a.id}`).join('  ')}`,
          `Config:    ${configPath ?? 'built-in default'}`,
          `Provider:  set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL`,
        ].join('\n'));
        break;
      default:
        addSystem(`Unknown command: ${cmd}. Try /help`);
    }
  }, [config, configPath, addSystem]);

  const handleSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setInputValue('');

    if (trimmed.startsWith('/')) { handleCommand(trimmed); return; }

    // Chain mode: "@nova >> @orion" — pipe each agent's response to the next
    if (trimmed.includes(' >> ')) {
      const parts = trimmed.split(' >> ');
      // Extract the initial user message (text before the first @mention chain)
      // Support: "some message @nova >> @orion" or "@nova >> @orion"
      const firstPart = parts[0].trim();
      const mentionMatch = firstPart.match(/^(.*?)(@\w+)\s*$/);
      let userMessage: string;
      let chainIds: AgentId[];

      if (mentionMatch) {
        userMessage = (mentionMatch[1].trim() || firstPart.replace(/@\w+/, '').trim()) || firstPart;
        chainIds = [mentionMatch[2].slice(1) as AgentId, ...parts.slice(1).map((p) => {
          const m = p.trim().match(/@(\w+)/);
          return (m ? m[1] : p.trim()) as AgentId;
        })];
      } else {
        // No @mention in first part — treat first part as user message, rest as agents
        userMessage = firstPart;
        chainIds = parts.slice(1).map((p) => {
          const m = p.trim().match(/@(\w+)/);
          return (m ? m[1] : p.trim()) as AgentId;
        });
        // If first part is an @mention itself (e.g. "@nova >> @orion" with no prefix)
        const firstMention = firstPart.match(/^@(\w+)$/);
        if (firstMention) {
          chainIds = [firstMention[1] as AgentId, ...chainIds];
          userMessage = '';
        }
      }

      const validChainIds = chainIds.filter((id) => config.agents.some((a) => a.id === id));
      if (validChainIds.length < 2) {
        // Not a valid chain — fall through to normal routing
      } else {
        const displayMessage = userMessage || trimmed;
        dispatch({ type: 'ADD', msg: { id: crypto.randomUUID(), type: 'user', content: displayMessage, streaming: false, timestamp: Date.now() } });
        historyRef.current = [...historyRef.current.slice(-20), { role: 'user', content: displayMessage }];
        addSystem(`⛓ Chain mode: ${validChainIds.map((id) => `@${id}`).join(' → ')}`);

        void (async () => {
          let currentInput = userMessage || displayMessage;
          for (const agentId of validChainIds) {
            currentInput = await streamFromAgentAsync(agentId, currentInput);
          }
        })();
        return;
      }
    }

    dispatch({ type: 'ADD', msg: { id: crypto.randomUUID(), type: 'user', content: trimmed, streaming: false, timestamp: Date.now() } });
    historyRef.current = [...historyRef.current.slice(-20), { role: 'user', content: trimmed }];

    const targets = modeRef.current === 'swarm'
      ? config.agents.map((a) => a.id)
      : routeMessage(trimmed, config.agents);

    for (const agentId of targets) {
      streamFromAgent(agentId, trimmed);
    }
  }, [config, handleCommand, streamFromAgent, streamFromAgentAsync, addSystem]);

  // Derive provider label for header
  const sampleModel = getEffectiveModel(config.agents[0], config.globalModel);
  const providerLabel = `${sampleModel.provider}/${sampleModel.name.split('-').slice(0, 2).join('-')}`;

  // Memoize terminal dimensions — recalculating on every render causes Ink to
  // reflow the layout and append new lines instead of updating in-place.
  const termWidthRef = useRef(process.stdout.columns ?? 100);
  const termHeightRef = useRef(process.stdout.rows ?? 24);
  const termWidth = termWidthRef.current;
  const termHeight = termHeightRef.current;
  const agentPanelWidth = Math.min(22, Math.floor(termWidth * 0.2));
  const feedWidth = termWidth - agentPanelWidth;

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      <Header
        shellName={config.shellName}
        activeCount={state.activeAgents.size}
        totalCount={config.agents.length}
        mode={state.mode}
        provider={providerLabel}
        configPath={configPath}
        width={termWidth}
      />

      <Box flexDirection="row" flexGrow={1}>
        <AgentList agents={config.agents} activeAgents={state.activeAgents} width={agentPanelWidth} />
        <Feed messages={state.messages} agents={config.agents} width={feedWidth} mode={state.mode} usingDefault={usingDefault} />
      </Box>

      <Box borderStyle="single" borderColor="gray" paddingX={1} width={termWidth}>
        <Text color="green" bold>› </Text>
        <TextInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder={`Message your agents... (@${config.agents[0]?.id ?? 'agent'}, /swarm, /help)`}
        />
      </Box>

      <StatusBar mode={state.mode} agentCount={config.agents.length} width={termWidth} />
    </Box>
  );
}
