import { api } from '@/lib/api';
import type {
  MarkReadRequest,
  MarkReadResponse,
  NotificationListResponse,
} from '@/types/api';

/** 알림 피드 (헤더 벨) — keyset cursor(id DESC) + unread_count 동봉. 인증 필수. */
export function listNotifications(opts: {
  cursor?: string;
  limit?: number;
} = {}): Promise<NotificationListResponse> {
  return api.get<NotificationListResponse>('/v1/notifications', {
    cursor: opts.cursor,
    limit: opts.limit,
  });
}

/** 읽음 처리 — ids 지정 또는 { all: true }. 갱신된 unread_count 반환. */
export function markNotificationsRead(
  body: MarkReadRequest,
): Promise<MarkReadResponse> {
  return api.patch<MarkReadResponse>('/v1/notifications/read', body);
}
