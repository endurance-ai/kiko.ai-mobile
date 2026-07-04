import {
  ApiError,
  BASE_URL,
  getCurrentAccessToken,
  notifyUnauthorized,
  refreshAccessToken,
} from '@/lib/api';
import type { ApiErrorBody, ClarifyPayload, ProductRef } from '@/types/api';

/** Daily-cap quota meta returned on every `session` event (PR #102).
 *
 * 서버 표기 규약:
 *   - `daily_cap: 0` + `cap_remaining: null` → 무제한 (developer / pro tier)
 *   - `daily_cap: N` + `cap_remaining: M`   → 유한 캡, 잔여 M
 *
 * 따라서 `cap_remaining` 을 절대 `0` 으로 강제 변환하지 않는다. null 을
 * 그대로 남겨야 무제한과 "잔여 0" 을 구분할 수 있음. 잠금 판정은
 * [[isCapExhausted]] 로 통일. */
export interface CapMeta {
  user_tier: string;
  daily_cap: number;
  cap_used: number;
  cap_remaining: number | null;
  cap_reset_at: string;
}

/** 유한 캡인데 잔여가 0 이하일 때만 소진 (=잠금) 판정.
 * daily_cap===0 또는 cap_remaining===null 은 무제한 → 절대 소진 아님. */
export function isCapExhausted(cap: CapMeta): boolean {
  if (cap.daily_cap <= 0) return false;
  if (cap.cap_remaining == null) return false;
  return cap.cap_remaining <= 0;
}

/** Payload of the `cap_reached` event — terminates the turn. */
export interface CapReachedInfo {
  code: string;
  user_tier: string;
  used: number;
  cap: number;
  remaining: number;
  reset_at: string;
  cta: string;
}

export interface ChatStreamHandlers {
  onSession?: (sessionId: string, cap?: CapMeta) => void;
  onTextDelta?: (delta: string) => void;
  onProduct?: (product: ProductRef) => void;
  /**
   * Server `clarify` event — inline-keyboard prompt (pick_item carousel,
   * gender pick, category pick, ...). The client should render the options
   * as buttons; on tap call sendCallbackStream(sessionId, option.callback,
   * option.label) which resumes the turn.
   */
  onClarify?: (payload: ClarifyPayload) => void;
  /**
   * Silent heartbeat during long server-side steps (e.g. Vision extract, ~15s).
   * Not user-visible — the client uses it only to reset its stall-timeout so a
   * slow-but-alive turn is not falsely cancelled.
   */
  onProgress?: (stage: string) => void;
  /** Emitted after products are persisted as a result set (server PR #96). */
  onSearch?: (searchId: string, total?: number) => void;
  /** Daily token cap hit — server skips graph run and doesn't save the turn. */
  onCapReached?: (info: CapReachedInfo) => void;
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
      if (typeof id !== 'string') return false;
      const cap: CapMeta | undefined =
        typeof data.daily_cap === 'number'
          ? {
              user_tier: typeof data.user_tier === 'string' ? data.user_tier : 'free',
              daily_cap: data.daily_cap,
              cap_used: typeof data.cap_used === 'number' ? data.cap_used : 0,
              cap_remaining:
                typeof data.cap_remaining === 'number'
                  ? data.cap_remaining
                  : null, // null = 무제한 (developer/pro tier). 0 으로 낮추지 말 것.
              cap_reset_at:
                typeof data.cap_reset_at === 'string' ? data.cap_reset_at : '',
            }
          : undefined;
      handlers.onSession?.(id, cap);
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
        product_id: typeof data.product_id === 'number' ? data.product_id : null,
      };
      handlers.onProduct?.(product);
      return false;
    }
    case 'search': {
      const id = data.search_id;
      const total = typeof data.total === 'number' ? data.total : undefined;
      if (typeof id === 'string') handlers.onSearch?.(id, total);
      return false;
    }
    case 'progress': {
      const stage = typeof data.stage === 'string' ? data.stage : '';
      handlers.onProgress?.(stage);
      return false;
    }
    case 'clarify': {
      const axis = typeof data.axis === 'string' ? data.axis : 'unknown';
      const prompt = typeof data.prompt === 'string' ? data.prompt : '';
      const rawOptions = Array.isArray(data.options) ? data.options : [];
      const options = rawOptions
        .map((o: unknown) => {
          if (typeof o !== 'object' || o === null) return null;
          const rec = o as Record<string, unknown>;
          const label = typeof rec.label === 'string' ? rec.label : '';
          const callback = typeof rec.callback === 'string' ? rec.callback : '';
          if (!label || !callback) return null;
          return { label, callback };
        })
        .filter((o): o is { label: string; callback: string } => o !== null);
      if (options.length === 0) return false;
      handlers.onClarify?.({ axis, prompt, options });
      return false;
    }
    case 'cap_reached': {
      const info: CapReachedInfo = {
        code: typeof data.code === 'string' ? data.code : 'daily_token_cap_reached',
        user_tier: typeof data.user_tier === 'string' ? data.user_tier : 'free',
        used: typeof data.used === 'number' ? data.used : 0,
        cap: typeof data.cap === 'number' ? data.cap : 0,
        remaining: typeof data.remaining === 'number' ? data.remaining : 0,
        reset_at: typeof data.reset_at === 'string' ? data.reset_at : '',
        cta: typeof data.cta === 'string' ? data.cta : '',
      };
      handlers.onCapReached?.(info);
      // Don't terminate — server still sends `done` after this.
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
