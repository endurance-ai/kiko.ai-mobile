import { api } from '@/lib/api';
import type {
  LegalDocumentType,
  LegalVersionsResponse,
  RecordConsentRequest,
  RecordConsentResponse,
} from '@/types/api';

/**
 * GET /v1/legal/versions — current / latest TOS + Privacy versions and the
 * user's prior consent rows. Use this on first authenticated load to decide
 * whether a consent prompt is needed.
 */
export function getLegalVersions(): Promise<LegalVersionsResponse> {
  return api.get<LegalVersionsResponse>('/v1/legal/versions');
}

/** POST /v1/legal/consents — record consent for one document at a version. */
export function recordConsent(
  documentType: LegalDocumentType,
  version: string,
): Promise<RecordConsentResponse> {
  const body: RecordConsentRequest = {
    document_type: documentType,
    version,
  };
  return api.post<RecordConsentResponse>('/v1/legal/consents', body);
}

/**
 * Returns the doc types the user hasn't yet consented to at the current
 * server version. Empty array = fully consented.
 */
export function missingConsents(
  res: LegalVersionsResponse,
): LegalDocumentType[] {
  const missing: LegalDocumentType[] = [];
  const consented = new Map<LegalDocumentType, string>();
  for (const c of res.my_consents) {
    consented.set(c.document_type, c.version);
  }
  if (consented.get('tos') !== res.current.tos) missing.push('tos');
  if (consented.get('privacy') !== res.current.privacy) missing.push('privacy');
  return missing;
}
