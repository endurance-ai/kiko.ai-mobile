import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { apnsEnvironment } from '@/lib/apns-environment';
import { getStoredDeviceId, setStoredDeviceId } from '@/lib/device-id';
import { registerDevice } from '@/lib/devices';
import { useAuth } from '@/state/auth';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** iOS provisional/ephemeral authorization still delivers (quiet) pushes, so the
 * token is worth registering. Treat those as "usable" alongside a full grant. */
function isUsable(perm: Notifications.NotificationPermissionsStatus): boolean {
  if (perm.granted) return true;
  const ios = perm.ios?.status;
  return (
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function ensurePermission(): Promise<boolean> {
  let perm = await Notifications.getPermissionsAsync();
  if (!isUsable(perm) && (perm.status === 'undetermined' || perm.canAskAgain)) {
    perm = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  return isUsable(perm);
}

/** POST the current native token, persisting the returned device_id so future
 * registrations (and logout) target the same endpoint. Retries transient
 * failures; gives up quietly — next launch / token rotation re-attempts. */
async function registerWithRetry(pushToken: string, attempts = 3): Promise<void> {
  const isIos = Platform.OS === 'ios';
  for (let i = 0; i < attempts; i += 1) {
    try {
      const deviceId = (await getStoredDeviceId()) ?? undefined;
      const res = await registerDevice({
        push_token: pushToken,
        device_id: deviceId,
        platform: isIos ? 'ios' : 'android',
        provider: isIos ? 'apns' : 'fcm',
        environment: isIos ? apnsEnvironment() : undefined,
        app_version: Constants.expoConfig?.version,
        device_model: Device.modelName ?? undefined,
      });
      if (res?.device_id) await setStoredDeviceId(res.device_id);
      return;
    } catch {
      if (i === attempts - 1) return;
      await sleep(1000 * (i + 1));
    }
  }
}

/**
 * Registers the device's native APNs token with the server after the user
 * authenticates, and re-registers whenever iOS rotates the token
 * (`addPushTokenListener`). A cached token is never treated as permanent.
 *
 * Skips on simulator/web and when authorization is unusable. The server upserts
 * by device_id / endpoint, so re-runs are idempotent and transfer ownership on
 * account switch.
 */
export function useRegisterDevice(): void {
  const { status } = useAuth();
  const authedRef = useRef(false);
  useEffect(() => {
    authedRef.current = status === 'authenticated';
  }, [status]);

  // Token rotation: re-register the new token whenever it changes, but only
  // while signed in. Mounted once; the closure reads auth state via the ref.
  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!Device.isDevice) return;
    const sub = Notifications.addPushTokenListener((token) => {
      if (!authedRef.current || !token?.data) return;
      void registerWithRetry(String(token.data));
    });
    return () => sub.remove();
  }, []);

  // Initial registration on each transition into the authenticated state.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!Device.isDevice) return; // simulator: no APNs token

    void (async () => {
      try {
        if (!(await ensurePermission())) return;
        const token = await Notifications.getDevicePushTokenAsync();
        if (token?.data) await registerWithRetry(String(token.data));
      } catch {
        // Permission denied or transient failure — silent; retried next launch.
      }
    })();
  }, [status]);
}
