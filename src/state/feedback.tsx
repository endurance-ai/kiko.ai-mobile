import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { FeedbackRating, FeedbackReasonKey } from "@/types/api";

export type { FeedbackRating, FeedbackReasonKey };

export interface ReasonChip {
  key: FeedbackReasonKey;
  label: string;
}

export const NEGATIVE_REASONS: ReasonChip[] = [
  { key: "mood_off", label: "무드가 안 맞아요" },
  { key: "fit", label: "핏이 안 맞아요" },
  { key: "color", label: "색이 안 맞아요" },
  { key: "category_wrong", label: "옷 종류가 달라요" },
  { key: "too_expensive", label: "너무 비싸요" },
  { key: "too_similar", label: "비슷비슷해요" },
];

export const POSITIVE_REASONS: ReasonChip[] = [
  { key: "mood_match", label: "무드가 딱 맞아요" },
  { key: "fit_color_good", label: "핏 / 색이 좋아요" },
  { key: "new_brand", label: "새로운 브랜드예요" },
  { key: "price_good", label: "가격이 좋아요" },
];

export interface FeedbackRecord {
  turnKey: string;
  rating: FeedbackRating;
  reasons: FeedbackReasonKey[];
  note: string;
  submittedAt: number;
}

interface Ctx {
  getSubmitted: (turnKey: string) => FeedbackRating | null;
  rememberSubmitted: (rec: Omit<FeedbackRecord, "submittedAt">) => void;
  records: FeedbackRecord[];
}

const FeedbackCtx = createContext<Ctx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);

  const getSubmitted = useCallback(
    (turnKey: string) =>
      records.find((r) => r.turnKey === turnKey)?.rating ?? null,
    [records],
  );

  const rememberSubmitted = useCallback(
    (rec: Omit<FeedbackRecord, "submittedAt">) => {
      const next: FeedbackRecord = { ...rec, submittedAt: Date.now() };
      setRecords((prev) => [
        next,
        ...prev.filter((r) => r.turnKey !== rec.turnKey),
      ]);
    },
    [],
  );

  const ctx = useMemo(
    () => ({ getSubmitted, rememberSubmitted, records }),
    [getSubmitted, rememberSubmitted, records],
  );
  return <FeedbackCtx.Provider value={ctx}>{children}</FeedbackCtx.Provider>;
}

export function useFeedback(): Ctx {
  const ctx = useContext(FeedbackCtx);
  if (!ctx) throw new Error("useFeedback must be inside <FeedbackProvider>");
  return ctx;
}
