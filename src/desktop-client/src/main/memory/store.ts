/**
 * memory/store.ts
 * ---------------
 * 基于 MEMORY.md 文件的长期记忆存储。
 */

import * as fs from 'fs';
import * as path from 'path';

export class MemoryStore {
  private memoryFile: string;

  constructor(workspaceDir: string) {
    const memoryDir = path.join(workspaceDir, 'memory');
    fs.mkdirSync(memoryDir, { recursive: true });
    this.memoryFile = path.join(memoryDir, 'MEMORY.md');
  }

  getMemoryContext(): string {
    if (!fs.existsSync(this.memoryFile)) return '';
    try {
      return fs.readFileSync(this.memoryFile, 'utf-8').trim();
    } catch {
      return '';
    }
  }

  write(content: string): void {
    fs.writeFileSync(this.memoryFile, content, 'utf-8');
  }

  append(entry: string): void {
    const separator = fs.existsSync(this.memoryFile) ? '\n' : '';
    fs.appendFileSync(this.memoryFile, separator + entry, 'utf-8');
  }
}
