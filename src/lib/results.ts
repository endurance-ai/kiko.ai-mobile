import { api } from '@/lib/api';
import type { ResultSetPageResponse } from '@/types/api';

export interface GetResultSetPageOpts {
  cursor?: string;
  limit?: number;
}

/**
 * GET /v1/results/{search_id} — paginate the full ranked product list for a
 * single search. Opening a result set flips its `is_listed=TRUE` server-side
 * (promotion). Used by the "더보기" grid page in list.tsx.
 */
export function getResultSetPage(
  searchId: string,
  opts: GetResultSetPageOpts = {},
): Promise<ResultSetPageResponse> {
  return api.get<ResultSetPageResponse>(
    `/v1/results/${encodeURIComponent(searchId)}`,
    { cursor: opts.cursor, limit: opts.limit },
  );
}
