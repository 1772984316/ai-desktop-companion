/**
 * agent/types.ts
 * --------------
 * Agent 核心类型定义。
 */

export interface AgentConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  systemPromptFile?: string;
  maxIterations?: number;
  contextWindowTokens?: number;
}

export interface AppConfig {
  agent: AgentConfig;
  heartbeat?: {
    enabled: boolean;
    intervalSeconds: number;
  };
  tools?: {
    whitelist?: WhitelistConfig;
  };
}

export interface WhitelistConfig {
  apps: Array<{ name: string; path: string }>;
  domains: string[];
  paths: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCallRequest[];
  hasToolCalls: boolean;
  finishReason: string;
}
