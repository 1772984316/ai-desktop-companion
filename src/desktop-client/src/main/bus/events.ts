/**
 * bus/events.ts
 * -------------
 * Agent 消息总线的事件类型。
 */

export interface InboundMessage {
  channel: string;
  senderId: string;
  chatId: string;
  content: string;
  timestamp: Date;
  media?: string[];
  metadata?: Record<string, unknown>;
  sessionKeyOverride?: string;
}

export function inboundSessionKey(msg: InboundMessage): string {
  return msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
}

export interface OutboundMessage {
  channel: string;
  chatId: string;
  content: string;
  metadata?: Record<string, unknown>;
}
