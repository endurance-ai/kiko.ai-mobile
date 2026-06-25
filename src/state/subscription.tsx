import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export type Subscription = {
  active: boolean;
  /** Auto-renewing monthly product id (StoreKit2 productID, mock 값). */
  productId: string;
  /** ISO date string for next billing — backend `subscription.next_billing_at`. */
  nextBillingAt: string;
  /** When user first subscribed — `subscription.started_at`. */
  startedAt: string;
};

const MOCK_INACTIVE: Subscription = {
  active: false,
  productId: 'kiko.membership.monthly',
  nextBillingAt: '',
  startedAt: '',
};

const MOCK_ACTIVE: Subscription = {
  active: true,
  productId: 'kiko.membership.monthly',
  nextBillingAt: '2026-07-18',
  startedAt: '2026-06-18',
};

type Ctx = {
  subscription: Subscription;
  /** Stub for StoreKit2 purchase → POST /iap/verify path. */
  activate: () => void;
  /** Local-only flip (App Store cancel happens externally; we wait for ASN v2). */
  deactivate: () => void;
};

const SubCtx = createContext<Ctx | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [sub, setSub] = useState<Subscription>(MOCK_INACTIVE);

  const activate = useCallback(() => setSub(MOCK_ACTIVE), []);
  const deactivate = useCallback(() => setSub(MOCK_INACTIVE), []);

  const ctx = useMemo(
    () => ({ subscription: sub, activate, deactivate }),
    [sub, activate, deactivate],
  );
  return <SubCtx.Provider value={ctx}>{children}</SubCtx.Provider>;
}

export function useSubscription(): Ctx {
  const ctx = useContext(SubCtx);
  if (!ctx) throw new Error('useSubscription must be inside <SubscriptionProvider>');
  return ctx;
}

export function formatKoreanDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${y}. ${parseInt(m, 10)}. ${parseInt(d, 10)}.`;
}
