import { api } from '@/lib/api';
import type {
  LinkCheckResponse,
  ProductDetail,
  RecordViewRequest,
  RecordViewResponse,
  ViewedListResponse,
} from '@/types/api';

export function getProduct(productId: string | number): Promise<ProductDetail> {
  return api.get<ProductDetail>(`/v1/products/${encodeURIComponent(String(productId))}`);
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

export function checkProductLink(productId: string | number): Promise<LinkCheckResponse> {
  return api.post<LinkCheckResponse>(
    `/v1/products/${encodeURIComponent(String(productId))}/link-check`,
  );
}
