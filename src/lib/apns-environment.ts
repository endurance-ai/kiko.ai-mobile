import type { ApnsEnvironment } from '@/types/api';

/**
 * APNs environment of the SIGNED build (`development` = sandbox, `production`).
 *
 * Derived from `EXPO_PUBLIC_APNS_ENV`, injected per EAS build profile in
 * eas.json (development/development-device/preview → development; production →
 * production). This is intentionally NOT `__DEV__`: a store/TestFlight build can
 * still evaluate `__DEV__` tooling, and the APNs environment must match the
 * entitlement (`aps-environment`) of the signed binary, not the JS runtime mode.
 *
 * Falls back to `production` when unset so a misconfigured build never silently
 * registers a token against sandbox in production — the server also defaults to
 * production for legacy requests.
 */
export function apnsEnvironment(): ApnsEnvironment {
  return process.env.EXPO_PUBLIC_APNS_ENV === 'development' ? 'development' : 'production';
}
