import { z } from 'zod';

export interface ToolConfig<T extends z.ZodTypeAny> {
  name: string;
  description: string;
  schema: T;
  execute: (input: z.infer<T>) => Promise<any>;
}

export class Tool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  public name: string;
  public description: string;
  public schema: T;
  private executor: (input: z.infer<T>) => Promise<any>;

  constructor(config: ToolConfig<T>) {
    this.name = config.name;
    this.description = config.description;
    this.schema = config.schema;
    this.executor = config.execute;
  }

  async run(input: any): Promise<any> {
    const parsed = this.schema.parse(input);
    return await this.executor(parsed);
  }

  getSchemaDefinition(): any {
    // In a full implementation, this uses a library like zod-to-json-schema
    // to expose the arguments schema to the LLM
    return {};
  }
}
