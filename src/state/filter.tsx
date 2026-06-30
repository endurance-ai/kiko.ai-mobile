import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type Gender = 'unisex' | 'women' | 'men' | 'any';

/**
 * Price filter as upper bound in 10,000 KRW units (10-500, step 10).
 * 500 = "무관" (no cap). Anything below = "{value}만원 이하".
 */
export type FilterValue = { gender: Gender; priceMax: number };

export const PRICE_MIN = 10;
export const PRICE_MAX = 500;
export const PRICE_STEP = 10;

const GENDER_LABEL: Record<Gender, string> = {
  unisex: '공용',
  women: '여성',
  men: '남성',
  any: '무관',
};

export function buildPriceLabel(priceMax: number): string {
  return priceMax >= PRICE_MAX ? '무관' : `${priceMax}만원 이하`;
}

export function buildFilterLabel({ gender, priceMax }: FilterValue): string {
  // Drop "무관" segments so the chip stays short when filters are open-ended.
  // Both wide-open → '필터'; one set → only that segment.
  const parts: string[] = [];
  if (gender !== 'any') parts.push(GENDER_LABEL[gender]);
  if (priceMax < PRICE_MAX) parts.push(buildPriceLabel(priceMax));
  return parts.length === 0 ? '필터' : parts.join(' · ');
}

const DEFAULT_FILTER: FilterValue = { gender: 'unisex', priceMax: PRICE_MAX };

type Ctx = {
  value: FilterValue;
  setValue: (next: FilterValue) => void;
};

const FilterCtx = createContext<Ctx | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<FilterValue>(DEFAULT_FILTER);
  const ctx = useMemo(() => ({ value, setValue }), [value]);
  return <FilterCtx.Provider value={ctx}>{children}</FilterCtx.Provider>;
}

export function useFilter(): Ctx {
  const ctx = useContext(FilterCtx);
  if (!ctx) {
    throw new Error('useFilter must be used inside <FilterProvider>');
  }
  return ctx;
}

export { GENDER_LABEL };
