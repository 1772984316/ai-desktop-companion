/**
 * services/llm.ts
 * ---------------
 * OpenAI-compatible LLM 客户端封装，支持工具调用。
 */

import OpenAI from 'openai';
import type { LLMResponse, ToolCallRequest, ToolDefinition } from '../agent/types';

export class LLMService {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; model: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.defaultModel = config.model;
  }

  async chat(params: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    tools?: ToolDefinition[];
    model?: string;
  }): Promise<LLMResponse> {
    const model = params.model ?? this.defaultModel;

    const reqParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: params.messages,
    };

    if (params.tools && params.tools.length > 0) {
      reqParams.tools = params.tools as OpenAI.Chat.ChatCompletionTool[];
    }

    const completion = await this.client.chat.completions.create(reqParams);
    const choice = completion.choices[0];
    const msg = choice.message;

    const toolCalls: ToolCallRequest[] = (msg.tool_calls ?? [])
      .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { function: { name: string; arguments: string } } =>
        tc.type === 'function' && 'function' in tc
      )
      .map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.parseArgs(tc.function.arguments),
      }));

    return {
      content: msg.content,
      toolCalls,
      hasToolCalls: toolCalls.length > 0,
      finishReason: choice.finish_reason ?? 'stop',
    };
  }

  async chatWithRetry(
    params: Parameters<LLMService['chat']>[0],
    retries = 3,
  ): Promise<LLMResponse> {
    let lastErr: unknown;
    for (let i = 0; i < retries; i++) {
      try {
        return await this.chat(params);
      } catch (err) {
        lastErr = err;
        const delay = 1000 * (i + 1);
        console.warn(`[LLM] Attempt ${i + 1} failed, retrying in ${delay}ms:`, err);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  private parseArgs(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}
