import { api } from '@/lib/api';
import type { SubscriptionResponse } from '@/types/api';

/**
 * GET /v1/subscription — current subscription state from the server's
 * StoreKit-side view. status='none' means the user has never subscribed.
 * manage_url is a static App Store deep link.
 */
export function getSubscription(): Promise<SubscriptionResponse> {
  return api.get<SubscriptionResponse>('/v1/subscription');
}
