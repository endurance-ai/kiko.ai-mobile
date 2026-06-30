import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type BannerPriority = 'error' | 'billing' | 'notice';

const PRIORITY_RANK: Record<BannerPriority, number> = {
  error: 3,
  billing: 2,
  notice: 1,
};

export interface BannerAction {
  label: string;
  onPress: () => void;
}

export interface BannerSpec {
  /** Stable id — `show` upserts if the id already exists. */
  id: string;
  priority: BannerPriority;
  /** Optional kicker shown above the title (small uppercase label, untranslated). */
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Action button. Triggering it doesn't auto-clear — handler decides. */
  action?: BannerAction;
  /** Auto-clear after this many ms (Banner runs the timer). Sticky if absent. */
  autoDismissMs?: number;
}

interface Ctx {
  /** The single banner that should currently render, or null. */
  active: BannerSpec | null;
  /** Add or replace a banner by id. Highest priority wins. */
  show: (banner: BannerSpec) => void;
  /** Remove a banner by id. */
  clear: (id: string) => void;
  /** Remove every banner. */
  clearAll: () => void;
}

const BannerCtx = createContext<Ctx | null>(null);

function pickActive(queue: BannerSpec[]): BannerSpec | null {
  if (queue.length === 0) return null;
  let best = queue[0];
  let bestRank = PRIORITY_RANK[best.priority];
  for (let i = 1; i < queue.length; i++) {
    const rank = PRIORITY_RANK[queue[i].priority];
    if (rank > bestRank) {
      best = queue[i];
      bestRank = rank;
    }
  }
  return best;
}

export function BannerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<BannerSpec[]>([]);

  const show = useCallback((banner: BannerSpec) => {
    setQueue((prev) => {
      const without = prev.filter((b) => b.id !== banner.id);
      return [...without, banner];
    });
  }, []);

  const clear = useCallback((id: string) => {
    setQueue((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearAll = useCallback(() => setQueue([]), []);

  const active = useMemo(() => pickActive(queue), [queue]);

  const ctx = useMemo(
    () => ({ active, show, clear, clearAll }),
    [active, show, clear, clearAll],
  );

  return <BannerCtx.Provider value={ctx}>{children}</BannerCtx.Provider>;
}

export function useBanner(): Ctx {
  const ctx = useContext(BannerCtx);
  if (!ctx) throw new Error('useBanner must be inside <BannerProvider>');
  return ctx;
}
