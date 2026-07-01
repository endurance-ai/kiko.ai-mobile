import { api } from '@/lib/api';
import type { HistoryFeedType, HistoryResponse } from '@/types/api';

export interface ListHistoryOpts {
  /** Scope the feed to one chat session. Omit for a user-wide feed. */
  sessionId?: string | null;
  type?: HistoryFeedType;
  cursor?: string;
  limit?: number;
}

/**
 * GET /v1/history — unified feed of result_sets + product views.
 * When `sessionId` is provided, filters to that chat session. Otherwise
 * returns the whole user's history across every session (default UX for
 * the history tab; matches how users think of "my history").
 */
export function listHistory(opts: ListHistoryOpts = {}): Promise<HistoryResponse> {
  return api.get<HistoryResponse>('/v1/history', {
    session_id: opts.sessionId || undefined,
    type: opts.type,
    cursor: opts.cursor,
    limit: opts.limit,
  });
}
