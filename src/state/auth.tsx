import * as SecureStore from '@/lib/secure-storage';
import { Platform } from 'react-native';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { identifyUser, resetAnalytics } from '@/lib/analytics';
import { api, registerAuthHooks } from '@/lib/api';
import type {
  AccessTokenResponse,
  SocialLoginRequest,
  TokenResponse,
} from '@/types/api';

const REFRESH_TOKEN_KEY = 'kiko.refresh_token';
const USER_ID_KEY = 'kiko.user_id';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  userId: string | null;
  signIn: (req: SocialLoginRequest) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

async function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

async function writeRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const setSession = useCallback(
    async (tokens: TokenResponse): Promise<void> => {
      accessTokenRef.current = tokens.access_token;
      setUserId(tokens.user_id);
      await writeRefreshToken(tokens.refresh_token);
      await SecureStore.setItemAsync(USER_ID_KEY, tokens.user_id);
      identifyUser(tokens.user_id);
      setStatus('authenticated');
    },
    [],
  );

  const clearSession = useCallback(async (): Promise<void> => {
    accessTokenRef.current = null;
    setUserId(null);
    await clearRefreshToken();
    await SecureStore.deleteItemAsync(USER_ID_KEY);
    resetAnalytics();
    setStatus('unauthenticated');
  }, []);

  const signIn = useCallback(
    async (req: SocialLoginRequest): Promise<void> => {
      const res = await api.post<TokenResponse>('/v1/auth/social', req, false);
      await setSession(res);
    },
    [setSession],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const refreshToken = await readRefreshToken();
    if (refreshToken) {
      try {
        await api.post('/v1/auth/logout', { refresh_token: refreshToken }, false);
      } catch {
        // ignore — local cleanup proceeds regardless
      }
    }
    await clearSession();
  }, [clearSession]);

  useEffect(() => {
    registerAuthHooks({
      getAccessToken: () => accessTokenRef.current,
      setAccessToken: (token) => {
        accessTokenRef.current = token;
      },
      getRefreshToken: readRefreshToken,
      onUnauthorized: clearSession,
    });
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 웹 개발 미리보기(pnpm web) 전용 mock 세션 — 소셜 로그인(Apple/카카오/
      // 구글)이 웹에서 동작하지 않아 디자인 확인이 막히므로 자동 통과시킨다.
      // __DEV__ + web 이중 가드라 네이티브/프로덕션 빌드에는 절대 포함되지 않음.
      // API 호출은 401 이 나지만 화면 렌더에는 영향 없음.
      if (Platform.OS === 'web' && __DEV__) {
        accessTokenRef.current = 'dev-web-preview-token';
        setUserId('dev-web-preview');
        setStatus('authenticated');
        return;
      }
      const refreshToken = await readRefreshToken();
      if (!refreshToken) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const res = await api.post<AccessTokenResponse>(
          '/v1/auth/refresh',
          { refresh_token: refreshToken },
          false,
        );
        if (cancelled) return;
        accessTokenRef.current = res.access_token;
        const storedUserId = await SecureStore.getItemAsync(USER_ID_KEY);
        setUserId(storedUserId);
        if (storedUserId) identifyUser(storedUserId);
        setStatus('authenticated');
      } catch {
        if (!cancelled) await clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, userId, signIn, signOut }),
    [status, userId, signIn, signOut],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
