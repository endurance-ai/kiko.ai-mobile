import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { getLegalVersions, missingConsents } from '@/lib/legal';
import { useAuth } from '@/state/auth';

const CONSENT_PATH = '/consent';
const SKIP_PATHS = new Set(['/login', '/consent', '/']);

/**
 * Runs once per authenticated session: checks current TOS / Privacy versions
 * against the user's prior consents and routes to /consent if any are
 * missing or stale. Idempotent — `ranRef` blocks repeated checks for the
 * same session. Failure is silent (network / auth glitches don't block the
 * app — server still enforces gate-relevant actions if needed).
 */
export function useConsentGate(): void {
  const { status } = useAuth();
  const pathname = usePathname();
  const ranRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || ranRef.current) return;
    // Don't bounce off the consent screen itself or the login surface.
    if (SKIP_PATHS.has(pathname)) return;
    ranRef.current = true;
    void (async () => {
      try {
        const res = await getLegalVersions();
        if (missingConsents(res).length > 0) {
          router.replace(CONSENT_PATH);
        }
      } catch {
        // Fail-open — server still enforces gate where it matters.
      }
    })();
  }, [status, pathname]);
}
