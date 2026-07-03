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

import { isCapExhausted, type CapMeta, type CapReachedInfo } from '@/lib/sse';

/**
 * Format an ISO reset timestamp into a short Korean hint for the cap banner.
 * Output: '내일 오전 9시' / '오후 3시' / '6/30 오전 9시' depending on distance.
 * Fail-open: returns empty string if parsing fails.
 */
export function formatCapResetHint(iso: string | null | undefined): string {
  if (!iso) return '';
  const reset = new Date(iso);
  if (Number.isNaN(reset.getTime())) return '';
  const now = new Date();
  const sameDay =
    reset.getFullYear() === now.getFullYear() &&
    reset.getMonth() === now.getMonth() &&
    reset.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    reset.getFullYear() === tomorrow.getFullYear() &&
    reset.getMonth() === tomorrow.getMonth() &&
    reset.getDate() === tomorrow.getDate();
  const hour = reset.getHours();
  const ampm = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const timeStr = `${ampm} ${hour12}시`;
  if (sameDay) return timeStr;
  if (isTomorrow) return `내일 ${timeStr}`;
  return `${reset.getMonth() + 1}/${reset.getDate()} ${timeStr}`;
}

// 무료 사용량 캡 관련 전역 상태. 이 컨텍스트가 있어야 홈/기존 채팅 모두
// 같은 잠금 상태를 공유한다 — 어느 한 화면에서 캡 소진이 감지되면 다른
// 채팅방으로 이동해도 컴포저가 잠긴 채로 유지된다.
interface Ctx {
  /** true 면 어떤 화면에서도 새 메시지 전송을 막아야 함. */
  locked: boolean;
  /** 다음 리셋 시각 (ISO). 배너 카피 계산에 사용. */
  resetAt: string | null;
  /** 마지막으로 받아본 캡 메타 — 90% 안내 배너 판단용. */
  meta: CapMeta | null;
  /** SSE `session` 이벤트에서 받은 CapMeta 로 상태 업데이트. */
  applyMeta: (cap: CapMeta) => void;
  /** SSE `cap_reached` 이벤트에서 받은 정보로 잠금. */
  markReached: (info: CapReachedInfo) => void;
}

const CapCtx = createContext<Ctx | null>(null);

export function CapProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [meta, setMeta] = useState<CapMeta | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUnlock = useCallback((iso: string) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    const ms = new Date(iso).getTime() - Date.now();
    if (ms > 0 && Number.isFinite(ms)) {
      resetTimerRef.current = setTimeout(() => {
        setLocked(false);
        resetTimerRef.current = null;
      }, ms);
    }
  }, []);

  const applyMeta = useCallback(
    (cap: CapMeta) => {
      setMeta(cap);
      setResetAt(cap.cap_reset_at ?? null);
      if (!isCapExhausted(cap)) {
        // 잔여 크레딧이 있거나 무제한 tier (developer/pro) — 잠금 해제.
        setLocked(false);
        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
          resetTimerRef.current = null;
        }
      } else {
        // 세션 시작 시 이미 소진 상태 (cap_reached 이벤트 없이도) — 잠금.
        setLocked(true);
        if (cap.cap_reset_at) scheduleUnlock(cap.cap_reset_at);
      }
    },
    [scheduleUnlock],
  );

  const markReached = useCallback(
    (info: CapReachedInfo) => {
      setLocked(true);
      setResetAt(info.reset_at ?? null);
      if (info.reset_at) scheduleUnlock(info.reset_at);
    },
    [scheduleUnlock],
  );

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({ locked, resetAt, meta, applyMeta, markReached }),
    [locked, resetAt, meta, applyMeta, markReached],
  );

  return <CapCtx.Provider value={value}>{children}</CapCtx.Provider>;
}

export function useCap(): Ctx {
  const ctx = useContext(CapCtx);
  if (!ctx) throw new Error('useCap must be inside <CapProvider>');
  return ctx;
}
