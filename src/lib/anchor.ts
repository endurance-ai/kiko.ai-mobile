/**
 * 핀 상품 앵커 prefix 파서.
 *
 * 컴포저에서 상품을 핀(anchor)한 채 메시지를 보내면 서버에는
 * `[#577005 · 브랜드 · 이름 · ₩89,000] 실제 메시지` 형태로 저장된다(유저
 * 버블엔 원래 실제 메시지만 노출). 재입장·세션 제목·결과셋 제목 등 서버가
 * 저장한 이 텍스트를 그대로 보이면 "[#577005]" 같은 정체불명 문자열이 남으므로,
 * 표시 전에 이 prefix 를 벗긴다. `#<숫자>` 가 든 대괄호일 때만 앵커로 취급해
 * 유저가 우연히 친 대괄호를 오인하지 않는다.
 */
import { chipLabelForQuery } from '@/state/suggestion-chips';

export function parseAnchorPrefix(content: string): {
  text: string;
  anchorProductId?: string;
} {
  const m = content.match(/^\[([^\]]*#\d+[^\]]*)\]\s*([\s\S]*)$/);
  if (!m) return { text: content };
  const id = m[1].match(/#(\d+)/);
  return { text: m[2], anchorProductId: id ? id[1] : undefined };
}

/** 앵커 prefix 를 벗긴 표시용 텍스트만 반환. */
export function stripAnchorPrefix(content: string | null | undefined): string {
  if (!content) return content ?? '';
  return parseAnchorPrefix(content).text;
}

/**
 * 채팅 표시용 텍스트 — 앵커 prefix 제거 + 유도 칩의 검증된 영어 query 를
 * 한국어 label 로 되돌린다. 세션 제목·결과셋 제목 등 서버가 저장한 텍스트를
 * 사용자에게 보일 때 사용 (칩 검색은 서버에 영어로 저장돼 있어 그대로면 영어).
 */
export function chatDisplayText(content: string | null | undefined): string {
  const stripped = stripAnchorPrefix(content);
  return chipLabelForQuery(stripped) ?? stripped;
}
