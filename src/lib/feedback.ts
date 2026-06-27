import { api } from '@/lib/api';
import type { FeedbackRequest, FeedbackResponse } from '@/types/api';

export function submitFeedback(req: FeedbackRequest): Promise<FeedbackResponse> {
  return api.post<FeedbackResponse>('/v1/feedback', req);
}
