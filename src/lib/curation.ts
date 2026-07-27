import { api } from '@/lib/api';
import type {
  CurationImpression,
  CurationImpressionResponse,
} from '@/types/api';

export function recordCurationImpressions(
  items: CurationImpression[],
): Promise<CurationImpressionResponse> {
  return api.post<CurationImpressionResponse>('/v1/curation/impressions', {
    items,
  });
}
