/**
 * Per-installation push device_id.
 *
 * The server returns a stable `device_id` from `POST /v1/devices`. We persist it
 * and send it back on every re-registration so the server updates the same
 * endpoint (and transfers ownership on account switch) instead of creating a new
 * row. It is also sent on logout to deactivate the endpoint. Stored in the OS
 * keychain via the same secure-storage wrapper as the refresh token.
 */
import * as SecureStore from '@/lib/secure-storage';

const DEVICE_ID_KEY = 'kiko.push_device_id';

export function getStoredDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

export function setStoredDeviceId(deviceId: string): Promise<void> {
  return SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
}

export function clearStoredDeviceId(): Promise<void> {
  return SecureStore.deleteItemAsync(DEVICE_ID_KEY);
}
