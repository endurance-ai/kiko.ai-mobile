import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { registerDevice } from '@/lib/devices';
import { useAuth } from '@/state/auth';

// 포그라운드 알림 표시 정책 — 이게 없으면 앱이 켜져 있을 때 도착한 푸시가
// 배너/사운드 없이 조용히 삼켜진다(iOS 기본). 목록/배지에도 반영.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

  // 알림 탭 → 알림함으로 이동. 리스너는 앱 실행 시(_layout) 일찍 등록되므로
  // 포그라운드·백그라운드는 물론 콜드스타트 탭 응답도 받는다.
  // (getLastNotificationResponseAsync 는 마지막 응답을 계속 보관해 매 실행마다
  //  재이동하는 함정이 있어 사용하지 않는다.)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/notifications-inbox');
    });
    return () => sub.remove();
  }, []);
}
