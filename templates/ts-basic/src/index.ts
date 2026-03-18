import { createAgent } from '@neuro/sdk';

const agent = createAgent({
  config: './neuro.agent.yaml',
  onMessage: async (msg, { llm, stream }) => {
    console.log(`Received task: ${msg.content}`);
    
    const response = await llm.execute(msg, { tools: [] });
    for await (const chunk of response) {
      stream.write(chunk);
    }
  }
});

agent.start(process.env.PORT ? parseInt(process.env.PORT) : 8080);
