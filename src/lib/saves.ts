import { api } from '@/lib/api';
import type {
  AddSaveRequest,
  SaveItem,
  SaveListResponse,
} from '@/types/api';

export function listSaves(
  opts: { cursor?: string; limit?: number } = {},
): Promise<SaveListResponse> {
  return api.get<SaveListResponse>('/v1/saves', {
    cursor: opts.cursor,
    limit: opts.limit,
  });
}

export function addSave(productId: string): Promise<SaveItem> {
  const body: AddSaveRequest = { product_id: productId };
  return api.post<SaveItem>('/v1/saves', body);
}

export function removeSave(productId: string): Promise<void> {
  return api.delete<void>(`/v1/saves/${encodeURIComponent(productId)}`);
}
