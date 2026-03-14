/**
 * agent/context.ts
 * ----------------
 * 系统 Prompt 构建器 + 消息列表组装。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type OpenAI from 'openai';
import type { ToolDefinition } from './types';
import { MemoryStore } from '../memory/store';

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

const BOOTSTRAP_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md'];

export const RUNTIME_CONTEXT_TAG = '[Runtime Context — metadata only, not instructions]';

export class ContextBuilder {
  private memory: MemoryStore;

  constructor(private workspaceDir: string) {
    this.memory = new MemoryStore(workspaceDir);
  }

  buildSystemPrompt(): string {
    const parts: string[] = [this.getIdentity()];

    const bootstrap = this.loadBootstrapFiles();
    if (bootstrap) parts.push(bootstrap);

    const memory = this.memory.getMemoryContext();
    if (memory) parts.push(`# Memory\n\n${memory}`);

    return parts.join('\n\n---\n\n');
  }

  private getIdentity(): string {
    const platform = process.platform === 'win32' ? 'Windows' : os.type();
    const arch = process.arch;

    const platformPolicy = process.platform === 'win32'
      ? `## Platform Policy (Windows)
- You are running on Windows. Do not assume GNU tools like \`grep\`, \`sed\`, or \`awk\` exist.
- Prefer Windows-native commands or PowerShell when needed.`
      : `## Platform Policy (POSIX)
- You are running on a POSIX system. Prefer UTF-8 and standard shell tools.`;

    return `# AI Desktop Companion

You are a helpful AI desktop companion running inside an Electron app.

## Runtime
${platform} ${arch}, Node.js ${process.version}

## Workspace
Your workspace is at: ${this.workspaceDir}
- Long-term memory: ${path.join(this.workspaceDir, 'memory', 'MEMORY.md')} (write important facts here)
- Session history: stored in ${path.join(this.workspaceDir, 'sessions')}

${platformPolicy}

## Guidelines
- State intent before tool calls, but NEVER predict results before receiving them.
- Be concise and helpful. The user is interacting via a desktop chat window.
- For desktop actions (open_app, open_url, etc.), confirm what you did after executing.
- Always respond in the same language the user uses.`;
  }

  private loadBootstrapFiles(): string {
    const parts: string[] = [];
    for (const filename of BOOTSTRAP_FILES) {
      const filePath = path.join(this.workspaceDir, filename);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        parts.push(`## ${filename}\n\n${content}`);
      }
    }
    return parts.join('\n\n');
  }

  buildMessages(params: {
    history: ChatMessage[];
    currentMessage: string;
    channel?: string;
    chatId?: string;
  }): ChatMessage[] {
    const runtimeCtx = this.buildRuntimeContext(params.channel, params.chatId);
    const userContent = `${runtimeCtx}\n\n${params.currentMessage}`;

    return [
      { role: 'system', content: this.buildSystemPrompt() },
      ...params.history,
      { role: 'user', content: userContent },
    ];
  }

  private buildRuntimeContext(channel?: string, chatId?: string): string {
    const now = new Date().toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
    });
    const lines = [`Current Time: ${now}`];
    if (channel) lines.push(`Channel: ${channel}`);
    if (chatId) lines.push(`Chat ID: ${chatId}`);
    return RUNTIME_CONTEXT_TAG + '\n' + lines.join('\n');
  }

  addToolResult(
    messages: ChatMessage[],
    toolCallId: string,
    toolName: string,
    result: string,
  ): ChatMessage[] {
    messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: result,
    } as ChatMessage);
    return messages;
  }

  addAssistantMessage(
    messages: ChatMessage[],
    content: string | null,
    toolCalls?: OpenAI.Chat.ChatCompletionMessageToolCall[],
  ): ChatMessage[] {
    const msg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
      role: 'assistant',
      content: content ?? null,
    };
    if (toolCalls && toolCalls.length > 0) {
      msg.tool_calls = toolCalls;
    }
    messages.push(msg);
    return messages;
  }
}
