import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerDevice } from '@/lib/devices';
import { useAuth } from '@/state/auth';

/**
 * Requests notification permission and registers the device's APNs token
 * with the server once per app launch after the user becomes authenticated.
 *
 * Skips on simulator/web and when permission is denied. Server-side upsert
 * on (user_id, apns_token) keeps this idempotent — re-runs are cheap.
 */
export function useRegisterDevice(): void {
  const { status } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || ranRef.current) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!Device.isDevice) return; // simulator: no APNs token
    ranRef.current = true;

    void (async () => {
      try {
        let perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') {
          perm = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
        }
        if (perm.status !== 'granted') return;

        const token = await Notifications.getDevicePushTokenAsync();
        if (!token?.data) return;

        await registerDevice({
          apns_token: token.data,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          app_version: Constants.expoConfig?.version,
          device_model: Device.modelName ?? undefined,
        });
      } catch {
        // Permission denied or transient failure — silent.
        // User can re-grant via system settings; next launch re-attempts.
      }
    })();
  }, [status]);
}
