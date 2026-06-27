import { api } from '@/lib/api';
import type { RegisterDeviceRequest, RegisterDeviceResponse } from '@/types/api';

export function registerDevice(
  req: RegisterDeviceRequest,
): Promise<RegisterDeviceResponse> {
  return api.post<RegisterDeviceResponse>('/v1/devices', req);
}
