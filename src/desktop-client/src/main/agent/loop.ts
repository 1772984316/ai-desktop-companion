/**
 * agent/loop.ts
 * -------------
 * Agent 核心处理循环：接收消息 → 构建上下文 → LLM 推理 → 工具执行 → 回复。
 */

import type OpenAI from 'openai';
import { ContextBuilder, RUNTIME_CONTEXT_TAG } from './context';
import { LLMService } from '../services/llm';
import { ToolRegistry } from '../tools/registry';
import { SessionManager } from '../session/manager';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import { inboundSessionKey } from '../bus/events';

const TOOL_RESULT_MAX_CHARS = 2000;

export type ProgressCallback = (content: string, isToolHint?: boolean) => void;

export class AgentLoop {
  private contextBuilder: ContextBuilder;
  private sessions: SessionManager;

  constructor(
    private llm: LLMService,
    private tools: ToolRegistry,
    private workspaceDir: string,
    private maxIterations = 40,
  ) {
    this.contextBuilder = new ContextBuilder(workspaceDir);
    this.sessions = new SessionManager(workspaceDir);
  }

  async process(
    msg: InboundMessage,
    onProgress?: ProgressCallback,
  ): Promise<OutboundMessage> {
    const sessionKey = inboundSessionKey(msg);
    const session = this.sessions.getOrCreate(sessionKey);

    // 斜杠命令处理
    const cmd = msg.content.trim().toLowerCase();
    if (cmd === '/new') {
      session.clear();
      this.sessions.save(session);
      this.sessions.invalidate(sessionKey);
      return { channel: msg.channel, chatId: msg.chatId, content: '新会话已开始。' };
    }
    if (cmd === '/help') {
      return {
        channel: msg.channel, chatId: msg.chatId,
        content: '可用命令：\n/new — 开始新对话\n/help — 显示帮助',
      };
    }

    const history = session.getHistory();
    const initialMessages = this.contextBuilder.buildMessages({
      history: history as OpenAI.Chat.ChatCompletionMessageParam[],
      currentMessage: msg.content,
      channel: msg.channel,
      chatId: msg.chatId,
    });

    const { content, allMessages } = await this.runLoop(initialMessages, onProgress);

    // 保存本次对话到 session
    this.saveTurn(session, allMessages, 1 + history.length);
    this.sessions.save(session);

    const finalContent = content ?? '处理完成，但没有回复内容。';

    return {
      channel: msg.channel,
      chatId: msg.chatId,
      content: finalContent,
      metadata: msg.metadata,
    };
  }

  private async runLoop(
    initialMessages: OpenAI.Chat.ChatCompletionMessageParam[],
    onProgress?: ProgressCallback,
  ): Promise<{ content: string | null; allMessages: OpenAI.Chat.ChatCompletionMessageParam[] }> {
    let messages = initialMessages;
    let iteration = 0;
    let finalContent: string | null = null;

    while (iteration < this.maxIterations) {
      iteration++;

      const response = await this.llm.chatWithRetry({
        messages,
        tools: this.tools.getDefinitions(),
      });

      if (response.hasToolCalls) {
        const thought = this.stripThink(response.content);
        if (thought && onProgress) onProgress(thought);

        const hint = this.formatToolHint(response.toolCalls);
        if (onProgress) onProgress(hint, true);

        const openaiToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] =
          response.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          }));

        messages = this.contextBuilder.addAssistantMessage(
          messages,
          response.content,
          openaiToolCalls,
        );

        for (const tc of response.toolCalls) {
          console.log(`[AgentLoop] Tool: ${tc.name}(${JSON.stringify(tc.arguments).slice(0, 100)})`);
          const result = await this.tools.execute(tc.name, tc.arguments);
          messages = this.contextBuilder.addToolResult(messages, tc.id, tc.name, result);
        }
      } else {
        const clean = this.stripThink(response.content);

        if (response.finishReason === 'error') {
          console.error('[AgentLoop] LLM returned error:', clean);
          finalContent = clean || '抱歉，调用 AI 模型时出错，请稍后重试。';
          break;
        }

        messages = this.contextBuilder.addAssistantMessage(messages, clean);
        finalContent = clean;
        break;
      }
    }

    if (finalContent === null && iteration >= this.maxIterations) {
      finalContent = `已达到最大工具调用轮次 (${this.maxIterations})，任务未能完成。请尝试将任务拆分为更小的步骤。`;
    }

    return { content: finalContent, allMessages: messages };
  }

  private saveTurn(
    session: ReturnType<SessionManager['getOrCreate']>,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    skip: number,
  ): void {
    for (const m of messages.slice(skip)) {
      const entry = { ...m } as Record<string, unknown>;
      const role = entry.role as string;
      const content = entry.content;

      if (role === 'assistant' && !content && !entry.tool_calls) continue;

      if (role === 'tool' && typeof content === 'string' && content.length > TOOL_RESULT_MAX_CHARS) {
        entry.content = content.slice(0, TOOL_RESULT_MAX_CHARS) + '\n... (truncated)';
      }

      if (role === 'user' && typeof content === 'string' && content.startsWith(RUNTIME_CONTEXT_TAG)) {
        const parts = content.split('\n\n', 2);
        if (parts.length > 1 && parts[1].trim()) {
          entry.content = parts[1];
        } else {
          continue;
        }
      }

      entry.timestamp = new Date().toISOString();
      session.messages.push(entry as never);
    }
    session.updatedAt = new Date();
  }

  private stripThink(text: string | null): string | null {
    if (!text) return null;
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null;
  }

  private formatToolHint(toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>): string {
    return toolCalls
      .map(tc => {
        const firstVal = Object.values(tc.arguments)[0];
        if (typeof firstVal === 'string') {
          const truncated = firstVal.length > 40 ? firstVal.slice(0, 40) + '…' : firstVal;
          return `${tc.name}("${truncated}")`;
        }
        return tc.name;
      })
      .join(', ');
  }
}
