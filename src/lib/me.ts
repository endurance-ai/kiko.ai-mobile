import { api } from '@/lib/api';
import type {
  DeleteMeRequest,
  UserPatchRequest,
  UserPatchResponse,
  UserProfile,
} from '@/types/api';

export function getMe(): Promise<UserProfile> {
  return api.get<UserProfile>('/v1/me');
}

export function updateMe(patch: UserPatchRequest): Promise<UserPatchResponse> {
  return api.patch<UserPatchResponse>('/v1/me', patch);
}

export function deleteMe(reason?: string): Promise<void> {
  const body: DeleteMeRequest = { confirm: true, reason };
  return api.delete<void>('/v1/me', body);
}
