import { api } from '@/lib/api';
import type { StyleNodesResponse } from '@/types/api';

/**
 * GET /v1/style-nodes — taxonomy of active style nodes loaded by the AI
 * server (id + code + EN name + keyword list). UI wiring deferred — kept
 * here so the server contract is reachable when we wire a category picker
 * / filter / discovery surface that depends on it.
 */
export function listStyleNodes(): Promise<StyleNodesResponse> {
  return api.get<StyleNodesResponse>('/v1/style-nodes');
}
