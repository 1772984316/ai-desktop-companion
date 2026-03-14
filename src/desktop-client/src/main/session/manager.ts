/**
 * session/manager.ts
 * ------------------
 * 基于 JSONL 文件的对话历史管理，与 Python 版本格式兼容。
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SessionMessage {
  role: string;
  content: string | unknown;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
  timestamp?: string;
}

export class Session {
  key: string;
  messages: SessionMessage[] = [];
  createdAt: Date;
  updatedAt: Date;
  lastConsolidated: number = 0;

  constructor(key: string) {
    this.key = key;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  getHistory(maxMessages: number = 500): SessionMessage[] {
    const unconsolidated = this.messages.slice(this.lastConsolidated);
    const sliced = maxMessages > 0 ? unconsolidated.slice(-maxMessages) : unconsolidated;

    // 从第一条 user 消息开始，避免孤立的 tool_result 块
    let startIdx = 0;
    for (let i = 0; i < sliced.length; i++) {
      if (sliced[i].role === 'user') { startIdx = i; break; }
    }

    return sliced.slice(startIdx).map(m => {
      const entry: SessionMessage = { role: m.role, content: m.content ?? '' };
      if (m.tool_calls) entry.tool_calls = m.tool_calls;
      if (m.tool_call_id) entry.tool_call_id = m.tool_call_id;
      if (m.name) entry.name = m.name;
      return entry;
    });
  }

  clear(): void {
    this.messages = [];
    this.lastConsolidated = 0;
    this.updatedAt = new Date();
  }
}

export class SessionManager {
  private sessionsDir: string;
  private cache = new Map<string, Session>();

  constructor(workspaceDir: string) {
    this.sessionsDir = path.join(workspaceDir, 'sessions');
    fs.mkdirSync(this.sessionsDir, { recursive: true });
  }

  getOrCreate(key: string): Session {
    if (this.cache.has(key)) return this.cache.get(key)!;

    const session = this.load(key) ?? new Session(key);
    this.cache.set(key, session);
    return session;
  }

  save(session: Session): void {
    session.updatedAt = new Date();
    const filePath = this.getSessionPath(session.key);

    const lines: string[] = [];
    const meta = {
      _type: 'metadata',
      key: session.key,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
      last_consolidated: session.lastConsolidated,
    };
    lines.push(JSON.stringify(meta));

    for (const msg of session.messages) {
      lines.push(JSON.stringify(msg));
    }

    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
    this.cache.set(session.key, session);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  private load(key: string): Session | null {
    const filePath = this.getSessionPath(key);
    if (!fs.existsSync(filePath)) return null;

    try {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
      const session = new Session(key);

      for (const line of lines) {
        const data = JSON.parse(line);
        if (data._type === 'metadata') {
          if (data.created_at) session.createdAt = new Date(data.created_at);
          session.lastConsolidated = data.last_consolidated ?? 0;
        } else {
          session.messages.push(data as SessionMessage);
        }
      }
      return session;
    } catch {
      return null;
    }
  }

  private getSessionPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
    return path.join(this.sessionsDir, `${safeKey}.jsonl`);
  }
}
