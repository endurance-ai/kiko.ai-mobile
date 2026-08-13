/**
 * ISO 시각 → 한국어 상대 표기 ("방금 / N분 전 / N시간 전 / 어제 / N일 전 / N주 전 / N달 전 / N년 전").
 * notifications-inbox 의 로컬 구현을 공용화 — 알림함·브랜드 소식이 동일 문법을 쓴다.
 */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}주 전`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}달 전`;
  return `${Math.floor(day / 365)}년 전`;
}
