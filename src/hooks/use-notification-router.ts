import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import type { NotificationData } from '@/types/api';

// Foreground presentation: show a banner even while the app is open. Set once at
// module load — expo requires the handler configured before a push arrives.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const PRODUCT_ROUTE = /^\/product\/\d+$/;

/** Route a tapped notification's versioned payload. Unknown schema versions or
 * routes are ignored safely (forward compatibility with future server payloads). */
function routeFromData(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const d = data as Partial<NotificationData>;
  if (d.schema_version !== 1) return; // unknown schema — ignore
  const route = typeof d.route === 'string' ? d.route : '';
  if (route === '/wishlist' || route === '/home' || PRODUCT_ROUTE.test(route)) {
    router.push(route as Href);
  }
}

/**
 * Installs the notification-response router. Routes taps from background/
 * foreground and, on mount, the notification that cold-started the app from a
 * terminated state. Routing happens ONLY on user interaction (a tap) — a
 * received-but-not-tapped push never navigates. Mount once, high in the tree
 * (root layout), after the router is available.
 */
export function useNotificationRouter(): void {
  useEffect(() => {
    let handledInitial = false;

    // Cold start: the notification that launched the app (terminated state).
    void (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && !handledInitial) {
        handledInitial = true;
        routeFromData(last.notification.request.content.data);
      }
    })();

    // Warm taps (app already running in background/foreground).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handledInitial = true;
      routeFromData(response.notification.request.content.data);
    });
    return () => sub.remove();
  }, []);
}
