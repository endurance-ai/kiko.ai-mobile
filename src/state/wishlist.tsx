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

import { trackEvent } from '@/lib/analytics';
import { addSave, listSaves, removeSave } from '@/lib/saves';
import { useAuth } from '@/state/auth';
import type { SaveListItem } from '@/types/api';

type WishlistStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Ctx {
  items: SaveListItem[];
  status: WishlistStatus;
  error: string | null;
  isSaved: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistCtx = createContext<Ctx | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const [items, setItems] = useState<SaveListItem[]>([]);
  const [status, setStatus] = useState<WishlistStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await listSaves({ limit: 100 });
      setItems(res.items);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : '찜 목록을 불러오지 못했어요.');
      setStatus('error');
    }
  }, []);

  // Auth 상태에 따라 로컬 캐시를 동기화. 로그아웃 시 이전 계정의 찜 목록이
  // 그대로 남아 다음 화면(홈/위시리스트)에 노출되는 버그를 방지.
  useEffect(() => {
    if (authStatus === 'authenticated') {
      void refresh();
    } else if (authStatus === 'unauthenticated') {
      setItems([]);
      setError(null);
      setStatus('idle');
      inFlight.current.clear();
    }
    // 'loading' 상태에서는 아무것도 안 함 (아직 refresh_token 검증 중).
  }, [authStatus, refresh]);

  const isSaved = useCallback(
    (productId: string) => items.some((it) => it.product?.id?.toString() === productId
      || it.save_id === productId),
    [items],
  );

  const toggle = useCallback(
    async (productId: string) => {
      if (inFlight.current.has(productId)) return;
      inFlight.current.add(productId);
      const existing = items.find(
        (it) => it.product?.id?.toString() === productId,
      );

      if (existing) {
        // Optimistic remove
        trackEvent("wishlist_remove", { product_id: productId });
        const snapshot = items;
        setItems((prev) => prev.filter((it) => it.save_id !== existing.save_id));
        try {
          await removeSave(productId);
        } catch {
          setItems(snapshot);
        } finally {
          inFlight.current.delete(productId);
        }
        return;
      }
      trackEvent("wishlist_add", { product_id: productId });

      // Optimistic add — refetch after success to pull product details
      try {
        await addSave(productId);
        await refresh();
      } catch {
        // no local change to roll back
      } finally {
        inFlight.current.delete(productId);
      }
    },
    [items, refresh],
  );

  const ctx = useMemo(
    () => ({ items, status, error, isSaved, toggle, refresh }),
    [items, status, error, isSaved, toggle, refresh],
  );

  return <WishlistCtx.Provider value={ctx}>{children}</WishlistCtx.Provider>;
}

export function useWishlist(): Ctx {
  const ctx = useContext(WishlistCtx);
  if (!ctx) throw new Error('useWishlist must be inside <WishlistProvider>');
  return ctx;
}
