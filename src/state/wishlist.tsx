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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
