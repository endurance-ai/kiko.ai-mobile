import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export type FeedbackRating = 'positive' | 'negative';

export type FeedbackRecord = {
  turnKey: string;
  rating: FeedbackRating;
  reasons: string[];
  note: string;
  submittedAt: number;
};

type Ctx = {
  /** Returns the submitted rating for the given turn, or null if not yet submitted. */
  getSubmitted: (turnKey: string) => FeedbackRating | null;
  submit: (rec: Omit<FeedbackRecord, 'submittedAt'>) => void;
  /** Read-only access for debug/menu surfaces. */
  records: FeedbackRecord[];
};

const FeedbackCtx = createContext<Ctx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);

  const getSubmitted = useCallback(
    (turnKey: string) => records.find((r) => r.turnKey === turnKey)?.rating ?? null,
    [records],
  );

  const submit = useCallback(
    (rec: Omit<FeedbackRecord, 'submittedAt'>) => {
      const next: FeedbackRecord = { ...rec, submittedAt: Date.now() };
      setRecords((prev) => [next, ...prev.filter((r) => r.turnKey !== rec.turnKey)]);
      // TODO: POST /feedback to backend with consent flag.
    },
    [],
  );

  const ctx = useMemo(() => ({ getSubmitted, submit, records }), [getSubmitted, submit, records]);
  return <FeedbackCtx.Provider value={ctx}>{children}</FeedbackCtx.Provider>;
}

export function useFeedback(): Ctx {
  const ctx = useContext(FeedbackCtx);
  if (!ctx) throw new Error('useFeedback must be inside <FeedbackProvider>');
  return ctx;
}

// Reason chip catalogs — engine-side they map to:
//   무드/색/핏 → embedding axis
//   카테고리 틀림 → subcategory mismatch
//   너무 비싸 → priceMax RPC
//   품절/링크 → CDN dead-link check
export const NEGATIVE_REASONS = [
  '무드가 안 맞아',
  '핏 · 실루엣',
  '색감',
  '카테고리 틀림',
  '너무 비싸',
  '품절 · 링크',
  '비슷비슷',
];

export const POSITIVE_REASONS = [
  '무드 딱 맞아',
  '새 브랜드 발견',
  '가격 좋아',
  '발견의 재미',
];
