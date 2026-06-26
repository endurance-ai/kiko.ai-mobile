import { api } from '@/lib/api';
import type {
  ChatRequest,
  ChatResponse,
  MessageListResponse,
  SessionSummary,
} from '@/types/api';

interface SessionRenameRequest {
  title: string;
}

export function listSessions(): Promise<SessionSummary[]> {
  return api.get<SessionSummary[]>('/v1/chat/sessions');
}

export function getMessages(
  sessionId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<MessageListResponse> {
  return api.get<MessageListResponse>(
    `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    { cursor: opts.cursor, limit: opts.limit },
  );
}

export function createSession(message: string): Promise<ChatResponse> {
  const body: ChatRequest = { message };
  return api.post<ChatResponse>('/v1/chat/sessions', body);
}

export function sendMessage(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  const body: ChatRequest = { message };
  return api.post<ChatResponse>(
    `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    body,
  );
}

export function renameSession(
  sessionId: string,
  title: string,
): Promise<SessionSummary> {
  const body: SessionRenameRequest = { title };
  return api.patch<SessionSummary>(
    `/v1/chat/sessions/${encodeURIComponent(sessionId)}`,
    body,
  );
}

export function deleteSession(sessionId: string): Promise<void> {
  return api.delete<void>(`/v1/chat/sessions/${encodeURIComponent(sessionId)}`);
}
