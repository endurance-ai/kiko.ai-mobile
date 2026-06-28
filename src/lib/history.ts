import { api } from '@/lib/api';
import type { HistoryFeedType, HistoryResponse } from '@/types/api';

export interface ListHistoryOpts {
  type?: HistoryFeedType;
  cursor?: string;
  limit?: number;
}

/**
 * GET /v1/history — session-scoped unified feed of result_sets + product views.
 * Server: feat/results-history-api (PR pending dev merge).
 */
export function listHistory(
  sessionId: string,
  opts: ListHistoryOpts = {},
): Promise<HistoryResponse> {
  return api.get<HistoryResponse>('/v1/history', {
    session_id: sessionId,
    type: opts.type,
    cursor: opts.cursor,
    limit: opts.limit,
  });
}
