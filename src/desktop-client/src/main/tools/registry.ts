/**
 * tools/registry.ts
 * -----------------
 * 工具注册表，管理所有可调用工具的注册与执行。
 */

import type { ToolDefinition } from '../agent/types';

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolDefinition['function']['parameters'];
  execute(args: Record<string, unknown>): Promise<string>;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: unknown tool "${name}"`;
    }
    try {
      return await tool.execute(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error executing ${name}: ${msg}`;
    }
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}
