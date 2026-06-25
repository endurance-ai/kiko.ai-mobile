import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { findProduct, MOCK_PRODUCTS, type Product } from '@/state/products';

type Ctx = {
  items: Product[];
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
};

const WishlistCtx = createContext<Ctx | null>(null);

// Pre-seed with a few saved items so the screen has content on first run.
const SEED_IDS = ['p1', 'p7', 'p9', 'p11', 'p6'];

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(SEED_IDS);

  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback((id: string) => {
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev],
    );
  }, []);

  const items = useMemo(
    () => ids.map((id) => findProduct(id)),
    [ids],
  );

  const ctx = useMemo(() => ({ items, isSaved, toggle }), [items, isSaved, toggle]);
  return <WishlistCtx.Provider value={ctx}>{children}</WishlistCtx.Provider>;
}

export function useWishlist(): Ctx {
  const ctx = useContext(WishlistCtx);
  if (!ctx) throw new Error('useWishlist must be inside <WishlistProvider>');
  return ctx;
}

// Mock seed exposed for demo/debug
export { MOCK_PRODUCTS };
