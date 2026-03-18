import { ConversationMessage } from '../types.js';

export interface MemoryStore {
  store(message: ConversationMessage): Promise<void>;
  query(limit?: number): Promise<ConversationMessage[]>;
  clear(): Promise<void>;
}

export class ConversationBufferMemory implements MemoryStore {
  private messages: ConversationMessage[] = [];
  private maxMessages: number;

  constructor(maxMessages: number = 50) {
    this.maxMessages = maxMessages;
  }

  async store(message: ConversationMessage): Promise<void> {
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  async query(limit?: number): Promise<ConversationMessage[]> {
    if (limit) {
      return this.messages.slice(-limit);
    }
    return [...this.messages];
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
}

export class LocalSemanticMemory implements MemoryStore {
  private memoryId: string;

  constructor(memoryId: string) {
    this.memoryId = memoryId;
    // In a full implementation, we would initialize a local SQLite or DuckDB instance here
    // with vector bindings (e.g. pgvector or sqlite-vss) to enable "RAG-in-a-Box" zero-config search
  }

  async store(message: ConversationMessage): Promise<void> {
    // Stub: Serialize the message, run it through an embedding model, and store vectors locally
    console.log(`[Neuro Memory] Stored embedding for message in semantic store: ${this.memoryId}`);
  }

  async query(limit?: number): Promise<ConversationMessage[]> {
    // Stub: Query local vector DB
    return [];
  }

  async clear(): Promise<void> {
    // Stub: Drop table/collection
  }
}
