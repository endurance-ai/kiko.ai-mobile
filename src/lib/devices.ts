import { api } from '@/lib/api';
import type {
  NotificationCategories,
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  UpdateNotificationsRequest,
  UpdateNotificationsResponse,
} from '@/types/api';

export function registerDevice(
  req: RegisterDeviceRequest,
): Promise<RegisterDeviceResponse> {
  return api.post<RegisterDeviceResponse>('/v1/devices', req);
}

/** Fetch the user's notification opt-ins (PR #98 added GET). */
export function getNotifications(): Promise<UpdateNotificationsResponse> {
  return api.get<UpdateNotificationsResponse>('/v1/me/notifications');
}

/** Patch a subset of notification categories. Server only writes provided keys. */
export function updateNotifications(
  categories: NotificationCategories,
): Promise<UpdateNotificationsResponse> {
  const body: UpdateNotificationsRequest = { categories };
  return api.patch<UpdateNotificationsResponse>('/v1/me/notifications', body);
}
