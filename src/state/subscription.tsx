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

import { getSubscription } from '@/lib/subscription';
import { useAuth } from '@/state/auth';
import type { SubscriptionResponse, SubscriptionStatus } from '@/types/api';

/**
 * Client projection of /v1/subscription. `active` is true for both
 * `active` and `grace` statuses so paywalled features stay accessible
 * during the App Store retry window.
 */
export type Subscription = {
  status: SubscriptionStatus;
  active: boolean;
  productId: string | null;
  expiresAt: string | null;
  willRenewAt: string | null;
  autoRenew: boolean | null;
  manageUrl: string;
};

const DEFAULT_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

const EMPTY: Subscription = {
  status: 'none',
  active: false,
  productId: null,
  expiresAt: null,
  willRenewAt: null,
  autoRenew: null,
  manageUrl: DEFAULT_MANAGE_URL,
};

function project(res: SubscriptionResponse): Subscription {
  return {
    status: res.status,
    active: res.status === 'active' || res.status === 'grace',
    productId: res.product_id,
    expiresAt: res.expires_at,
    willRenewAt: res.will_renew_at,
    autoRenew: res.auto_renew,
    manageUrl: res.manage_url || DEFAULT_MANAGE_URL,
  };
}

type Ctx = {
  subscription: Subscription;
  loading: boolean;
  /** Refresh from /v1/subscription. Call after StoreKit verify or restore. */
  refresh: () => Promise<void>;
};

const SubCtx = createContext<Ctx | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [sub, setSub] = useState<Subscription>(EMPTY);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') return;
    setLoading(true);
    try {
      const res = await getSubscription();
      setSub(project(res));
    } catch {
      // leave previous projection in place
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Fetch once when the session becomes authenticated; reset on sign-out.
  useEffect(() => {
    if (status === 'authenticated' && !fetchedRef.current) {
      fetchedRef.current = true;
      void refresh();
    }
    if (status === 'unauthenticated') {
      fetchedRef.current = false;
      setSub(EMPTY);
    }
  }, [status, refresh]);

  const ctx = useMemo(
    () => ({ subscription: sub, loading, refresh }),
    [sub, loading, refresh],
  );
  return <SubCtx.Provider value={ctx}>{children}</SubCtx.Provider>;
}

export function useSubscription(): Ctx {
  const ctx = useContext(SubCtx);
  if (!ctx) throw new Error('useSubscription must be inside <SubscriptionProvider>');
  return ctx;
}

export function formatKoreanDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
