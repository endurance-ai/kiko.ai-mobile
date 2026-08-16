import { api } from '@/lib/api';
import type { VisionAnalyzeResponse } from '@/types/api';

/**
 * POST /v1/image/analyze — 업로드한 이미지(/v1/uploads 로 만든 image_url)에서
 * 착용 상품을 검출해 항목 리스트 + 무드 태그를 받는다. 이미지 스테이징 화면의
 * 글래스 버튼(항목)·스타일 칩(무드) 데이터 소스.
 *
 * 백엔드는 ai-server 의 vision_extract 를 유저 인증 라우트로 감싼 것(내부 토큰
 * 전용 /debug/vision-analyze 의 authed 버전). 라우트가 아직 없으면 호출이 실패
 * 하므로, 호출부(home)가 catch 해서 목업으로 폴백한다.
 */
export function analyzeImage(imageUrl: string): Promise<VisionAnalyzeResponse> {
  return api.post<VisionAnalyzeResponse>('/v1/image/analyze', {
    image_url: imageUrl,
  });
}
