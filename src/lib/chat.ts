import { api } from '@/lib/api';
import { streamChatSSE, type ChatStreamController, type ChatStreamHandlers } from '@/lib/sse';
import type {
  ChatCallbackRequest,
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

export interface ChatSendOpts {
  /** 'women' | 'men' — 유저가 명시한 성별 선택. '공용' 은 undefined 로 전달해
   * 서버가 taste_profile pin 을 참조하거나 gender card 로 다시 물어보도록 한다. */
  gender?: string;
  /** Upper price bound in KRW (원). undefined or 0 = no ceiling. */
  priceMaxKrw?: number;
  /** Final CloudFront image_url from POST /v1/uploads. */
  attachedImageUrl?: string;
}

function buildRequest(message: string, opts?: ChatSendOpts): ChatRequest {
  return {
    message,
    gender: opts?.gender ?? null,
    price_max: opts?.priceMaxKrw && opts.priceMaxKrw > 0 ? opts.priceMaxKrw : null,
    attached_image_url: opts?.attachedImageUrl || null,
  };
}

/**
 * Open a new chat session with an initial message. Server streams the reply
 * as Server-Sent Events: session → text_delta* → product* → search → done (or error).
 */
export function createSessionStream(
  message: string,
  handlers: ChatStreamHandlers,
  opts?: ChatSendOpts,
): ChatStreamController {
  return streamChatSSE('/v1/chat/sessions', buildRequest(message, opts), handlers);
}

/**
 * Continue an existing chat session. Same SSE event sequence as createSessionStream.
 */
export function sendMessageStream(
  sessionId: string,
  message: string,
  handlers: ChatStreamHandlers,
  opts?: ChatSendOpts,
): ChatStreamController {
  return streamChatSSE(
    `/v1/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    buildRequest(message, opts),
    handlers,
  );
}

/**
 * Send a button tap from a `clarify` SSE event. `callbackData` is the option's
 * `callback` string (e.g. `item:0`, `clarify:gender:women`). `label` is the
 * button's display text — persisted as the user turn so chat history mirrors
 * what the user "said" by tapping. Returns the same SSE stream shape.
 */
export function sendCallbackStream(
  sessionId: string,
  callbackData: string,
  label: string | null | undefined,
  handlers: ChatStreamHandlers,
): ChatStreamController {
  const body: ChatCallbackRequest = { callback_data: callbackData, label: label ?? null };
  return streamChatSSE(
    `/v1/chat/sessions/${encodeURIComponent(sessionId)}/callback`,
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
