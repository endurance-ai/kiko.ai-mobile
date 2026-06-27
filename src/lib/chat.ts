import { api } from '@/lib/api';
import { streamChatSSE, type ChatStreamController, type ChatStreamHandlers } from '@/lib/sse';
import type {
  ChatRequest,
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

/**
 * Open a new chat session with an initial message. Server streams the reply
 * as Server-Sent Events: session → text_delta* → product* → done (or error).
 */
export function createSessionStream(
  message: string,
  handlers: ChatStreamHandlers,
): ChatStreamController {
  const body: ChatRequest = { message };
  return streamChatSSE('/v1/chat/sessions', body, handlers);
}

/**
 * Continue an existing chat session. Same SSE event sequence as createSessionStream.
 */
export function sendMessageStream(
  sessionId: string,
  message: string,
  handlers: ChatStreamHandlers,
): ChatStreamController {
  const body: ChatRequest = { message };
  return streamChatSSE(
    `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    body,
    handlers,
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
