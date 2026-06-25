import { api } from '@/lib/api';
import type {
  ChatRequest,
  ChatResponse,
  MessageListResponse,
  SessionSummary,
} from '@/types/api';

export function listSessions(): Promise<SessionSummary[]> {
  return api.get<SessionSummary[]>('/chat/sessions');
}

export function getMessages(
  sessionId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<MessageListResponse> {
  return api.get<MessageListResponse>(
    `/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    { cursor: opts.cursor, limit: opts.limit },
  );
}

export function createSession(message: string): Promise<ChatResponse> {
  const body: ChatRequest = { message };
  return api.post<ChatResponse>('/chat/sessions', body);
}

export function sendMessage(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  const body: ChatRequest = { message };
  return api.post<ChatResponse>(
    `/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    body,
  );
}
