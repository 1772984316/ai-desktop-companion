/**
 * heartbeat/service.ts
 * --------------------
 * 定时心跳服务：周期性唤醒 Agent 检查是否有待处理任务。
 *
 * 两阶段：
 *  Phase 1 (决策)：读取 HEARTBEAT.md，通过 LLM tool call 判断 skip/run。
 *  Phase 2 (执行)：仅当 Phase 1 返回 "run" 时，执行完整 Agent 流程。
 */

import * as fs from 'fs';
import * as path from 'path';
import { LLMService } from '../services/llm';

const HEARTBEAT_TOOL = [{
  type: 'function' as const,
  function: {
    name: 'heartbeat',
    description: 'Report heartbeat decision after reviewing tasks.',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['skip', 'run'],
          description: 'skip = nothing to do, run = has active tasks',
        },
        tasks: {
          type: 'string',
          description: 'Natural-language summary of active tasks (required for run)',
        },
      },
      required: ['action'],
    },
  },
}];

export class HeartbeatService {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private workspaceDir: string,
    private llm: LLMService,
    private model: string,
    private onExecute?: (tasks: string) => Promise<string>,
    private onNotify?: (response: string) => Promise<void>,
    private intervalSeconds: number = 30 * 60,
    private enabled: boolean = true,
  ) {}

  start(): void {
    if (!this.enabled || this.running) return;
    this.running = true;
    this.scheduleNext();
    console.log(`[Heartbeat] Started (every ${this.intervalSeconds}s)`);
  }

  stop(): void {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  async triggerNow(): Promise<string | null> {
    const content = this.readHeartbeatFile();
    if (!content) return null;

    const { action, tasks } = await this.decide(content);
    if (action !== 'run' || !this.onExecute) return null;
    return this.onExecute(tasks);
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      try { await this.tick(); } catch (err) {
        console.error('[Heartbeat] Error:', err);
      }
      this.scheduleNext();
    }, this.intervalSeconds * 1000);
  }

  private async tick(): Promise<void> {
    const content = this.readHeartbeatFile();
    if (!content) return;

    console.log('[Heartbeat] Checking for tasks...');
    const { action, tasks } = await this.decide(content);

    if (action !== 'run') { console.log('[Heartbeat] Nothing to do'); return; }

    console.log('[Heartbeat] Tasks found, executing...');
    if (this.onExecute) {
      const response = await this.onExecute(tasks);
      if (response && this.onNotify) await this.onNotify(response);
    }
  }

  private async decide(content: string): Promise<{ action: string; tasks: string }> {
    const response = await this.llm.chatWithRetry({
      messages: [
        { role: 'system', content: 'You are a heartbeat agent. Call the heartbeat tool to report your decision.' },
        { role: 'user', content: `Review the following HEARTBEAT.md and decide whether there are active tasks.\n\n${content}` },
      ],
      tools: HEARTBEAT_TOOL,
      model: this.model,
    });

    if (!response.hasToolCalls) return { action: 'skip', tasks: '' };

    const args = response.toolCalls[0].arguments;
    return {
      action: String(args.action ?? 'skip'),
      tasks: String(args.tasks ?? ''),
    };
  }

  private readHeartbeatFile(): string | null {
    const filePath = path.join(this.workspaceDir, 'HEARTBEAT.md');
    if (!fs.existsSync(filePath)) return null;
    try { return fs.readFileSync(filePath, 'utf-8').trim() || null; }
    catch { return null; }
  }
}
