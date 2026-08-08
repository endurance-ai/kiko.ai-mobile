import { api } from '@/lib/api';
import type {
  BrandHome,
  BrandProductsResponse,
  FollowListResponse,
  FollowResponse,
  UnfollowResponse,
} from '@/types/api';

/** 팔로우 + 알림 여부 설정. 이미 팔로우 중이면 notify 만 갱신(POST 재호출로 통합). */
export function followBrand(
  brandId: number | string,
  notify = true,
): Promise<FollowResponse> {
  return api.post<FollowResponse>(
    `/v1/brands/${encodeURIComponent(String(brandId))}/follow`,
    { notify },
  );
}

/** 언팔로우. */
export function unfollowBrand(brandId: number | string): Promise<UnfollowResponse> {
  return api.delete<UnfollowResponse>(
    `/v1/brands/${encodeURIComponent(String(brandId))}/follow`,
  );
}

/** 팔로우한 브랜드 목록 (설정 '팔로우 브랜드 관리'). */
export function listFollows(opts: {
  cursor?: string;
  limit?: number;
} = {}): Promise<FollowListResponse> {
  return api.get<FollowListResponse>('/v1/me/follows', {
    cursor: opts.cursor,
    limit: opts.limit,
  });
}

/** 브랜드 홈 (정보 + 팔로우 상태). */
export function getBrandHome(brandId: number | string): Promise<BrandHome> {
  return api.get<BrandHome>(`/v1/brands/${encodeURIComponent(String(brandId))}`);
}

/** 브랜드 상품 목록 (페이지네이션). */
export function getBrandProducts(
  brandId: number | string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<BrandProductsResponse> {
  return api.get<BrandProductsResponse>(
    `/v1/brands/${encodeURIComponent(String(brandId))}/products`,
    { cursor: opts.cursor, limit: opts.limit },
  );
}
