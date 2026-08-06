import { api } from '@/lib/api';
import type {
  LinkCheckResponse,
  OutboundRequest,
  OutboundResponse,
  ProductDetail,
  RecordViewRequest,
  RecordViewResponse,
  ViewedListResponse,
} from '@/types/api';

export function getProduct(
  productId: string | number,
  opts: { searchId?: string } = {},
): Promise<ProductDetail> {
  return api.get<ProductDetail>(
    `/v1/products/${encodeURIComponent(String(productId))}`,
    opts.searchId ? { search_id: opts.searchId } : undefined,
  );
}

export function recordProductView(
  productId: string | number,
  req: RecordViewRequest,
): Promise<RecordViewResponse> {
  return api.post<RecordViewResponse>(
    `/v1/products/${encodeURIComponent(String(productId))}/view`,
    req,
  );
}

export function listViewedProducts(opts: {
  sessionId: string;
  cursor?: string;
  limit?: number;
  dedup?: boolean;
}): Promise<ViewedListResponse> {
  return api.get<ViewedListResponse>('/v1/products/viewed', {
    session_id: opts.sessionId,
    cursor: opts.cursor,
    limit: opts.limit,
    dedup: opts.dedup === undefined ? undefined : String(opts.dedup),
  });
}

/** 외부몰 이동(구매 클릭) 서버 기록 — popular 랭킹 outbound 신호(가중 4) +
 *  taste 신호. fire-and-forget 로 호출(UX 무영향). */
export function recordOutbound(
  productId: string | number,
  req: OutboundRequest,
): Promise<OutboundResponse> {
  return api.post<OutboundResponse>(
    `/v1/products/${encodeURIComponent(String(productId))}/outbound`,
    req,
  );
}

export function checkProductLink(productId: string | number): Promise<LinkCheckResponse> {
  return api.post<LinkCheckResponse>(
    `/v1/products/${encodeURIComponent(String(productId))}/link-check`,
  );
}
