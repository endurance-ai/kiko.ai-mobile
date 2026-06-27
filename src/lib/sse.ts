import {
  ApiError,
  BASE_URL,
  getCurrentAccessToken,
  notifyUnauthorized,
  refreshAccessToken,
} from '@/lib/api';
import type { ApiErrorBody, ProductRef } from '@/types/api';

export interface ChatStreamHandlers {
  onSession?: (sessionId: string) => void;
  onTextDelta?: (delta: string) => void;
  onProduct?: (product: ProductRef) => void;
  /** Emitted after products are persisted as a result set (server PR #96). */
  onSearch?: (searchId: string) => void;
  onDone?: () => void;
  onError?: (detail: string) => void;
}

export interface ChatStreamController {
  cancel: () => void;
  promise: Promise<void>;
}

type SseEvent = { name: string; data: string };

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.detail ?? `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

function parseEventBlocks(buf: string): { events: SseEvent[]; tail: string } {
  // SSE events are separated by a blank line (\n\n).
  const parts = buf.split(/\r?\n\r?\n/);
  const tail = parts.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of parts) {
    if (!block.trim()) continue;
    let name = 'message';
    let data = '';
    for (const rawLine of block.split(/\r?\n/)) {
      if (rawLine.startsWith(':')) continue; // comment
      const colon = rawLine.indexOf(':');
      const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
      const value = colon === -1
        ? ''
        : rawLine.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') name = value;
      else if (field === 'data') data += data ? '\n' + value : value;
    }
    events.push({ name, data });
  }
  return { events, tail };
}

function dispatch(event: SseEvent, handlers: ChatStreamHandlers): boolean {
  let data: Record<string, unknown> = {};
  if (event.data) {
    try {
      data = JSON.parse(event.data) as Record<string, unknown>;
    } catch {
      // Ignore malformed payload; treat as empty.
    }
  }
  switch (event.name) {
    case 'session': {
      const id = data.session_id;
      if (typeof id === 'string') handlers.onSession?.(id);
      return false;
    }
    case 'text_delta': {
      const delta = data.delta;
      if (typeof delta === 'string') handlers.onTextDelta?.(delta);
      return false;
    }
    case 'product': {
      const product: ProductRef = {
        image_url: typeof data.image_url === 'string' ? data.image_url : '',
        caption: typeof data.caption === 'string' ? data.caption : '',
      };
      handlers.onProduct?.(product);
      return false;
    }
    case 'search': {
      const id = data.search_id;
      if (typeof id === 'string') handlers.onSearch?.(id);
      return false;
    }
    case 'done':
      handlers.onDone?.();
      return true;
    case 'error': {
      const detail = typeof data.detail === 'string' ? data.detail : 'Unknown error';
      handlers.onError?.(detail);
      return true;
    }
    default:
      return false;
  }
}

async function openStream(
  url: string,
  body: unknown,
  token: string | null,
  abortSignal: AbortSignal,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
    signal: abortSignal,
  });
}

export function streamChatSSE(
  path: string,
  body: unknown,
  handlers: ChatStreamHandlers,
): ChatStreamController {
  const abort = new AbortController();
  const url = new URL(path, BASE_URL).toString();

  const promise = (async () => {
    let token = getCurrentAccessToken();
    let res = await openStream(url, body, token, abort.signal);

    if (res.status === 401) {
      const fresh = await refreshAccessToken();
      if (fresh) {
        res = await openStream(url, body, fresh, abort.signal);
      }
      if (res.status === 401) {
        await notifyUnauthorized();
        const detail = await readErrorDetail(res);
        handlers.onError?.(detail);
        throw new ApiError(401, detail);
      }
    }

    if (!res.ok) {
      const detail = await readErrorDetail(res);
      handlers.onError?.(detail);
      throw new ApiError(res.status, detail);
    }

    if (!res.body) {
      const detail = 'No response body';
      handlers.onError?.(detail);
      throw new Error(detail);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let terminated = false;

    try {
      while (!terminated) {
        const { done, value } = await reader.read();
        if (value) {
          buf += decoder.decode(value, { stream: true });
          const { events, tail } = parseEventBlocks(buf);
          buf = tail;
          for (const ev of events) {
            if (dispatch(ev, handlers)) {
              terminated = true;
              break;
            }
          }
        }
        if (done) {
          // Flush any trailing event before exiting.
          if (buf.trim()) {
            const { events } = parseEventBlocks(buf + '\n\n');
            for (const ev of events) {
              if (dispatch(ev, handlers)) break;
            }
          }
          break;
        }
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      const detail = e instanceof Error ? e.message : String(e);
      handlers.onError?.(detail);
      throw e;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  })().catch((e) => {
    if ((e as { name?: string })?.name === 'AbortError') return;
    // Already reported through handlers.onError above.
  });

  return {
    cancel: () => abort.abort(),
    promise,
  };
}
