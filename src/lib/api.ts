import Constants from 'expo-constants';

import type { AccessTokenResponse, ApiErrorBody } from '@/types/api';

const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'https://dev-ai.kikoai.me';

type TokenGetter = () => string | null;
type TokenSetter = (accessToken: string) => void;
type RefreshTokenGetter = () => Promise<string | null>;
type UnauthorizedHandler = () => void | Promise<void>;

interface AuthHooks {
  getAccessToken: TokenGetter;
  setAccessToken: TokenSetter;
  getRefreshToken: RefreshTokenGetter;
  onUnauthorized: UnauthorizedHandler;
}

let hooks: AuthHooks | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function registerAuthHooks(next: AuthHooks): void {
  hooks = next;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!hooks) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await hooks!.getRefreshToken();
      if (!refreshToken) return null;

      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as AccessTokenResponse;
      hooks!.setAccessToken(data.access_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ApiErrorBody;
    return data.detail ?? res.statusText;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = opts;
  const url = buildUrl(path, query);

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let token = auth ? hooks?.getAccessToken() ?? null : null;
  let res = await send(token);

  if (res.status === 401 && auth && hooks) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      res = await send(fresh);
    }
    if (res.status === 401) {
      await hooks.onUnauthorized();
      throw new ApiError(401, await parseError(res));
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], auth = true) =>
    request<T>(path, { method: 'GET', query, auth }),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'PATCH', body, auth }),
  delete: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'DELETE', body, auth }),
};

export { BASE_URL };
