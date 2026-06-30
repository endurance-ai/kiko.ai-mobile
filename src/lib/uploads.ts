import { api, ApiError } from '@/lib/api';
import type {
  CreateUploadRequest,
  CreateUploadResponse,
  UploadContentType,
} from '@/types/api';

/**
 * POST /v1/uploads — reserve a presigned S3 PUT URL.
 * Server records the row as 'pending' and returns the final CloudFront URL
 * that the client can use immediately as the canonical image_url
 * (S3 PUT completes asynchronously but the URL is stable).
 */
export function createUpload(
  body: CreateUploadRequest,
): Promise<CreateUploadResponse> {
  return api.post<CreateUploadResponse>('/v1/uploads', body);
}

const _EXT_TO_CONTENT_TYPE: Record<string, UploadContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function detectContentType(filename: string): UploadContentType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return _EXT_TO_CONTENT_TYPE[ext] ?? 'image/jpeg';
}

/**
 * Upload the local file at `uri` to the presigned S3 URL via PUT.
 * Resolves on 2xx, throws ApiError otherwise so the caller can show a
 * banner / retry. Body is sent as a blob — works with expo-image-picker
 * file:// URIs because RN's fetch resolves them transparently.
 */
export async function uploadFile(
  localUri: string,
  uploadUrl: string,
  contentType: string,
): Promise<void> {
  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `S3 PUT failed: ${res.statusText || res.status}`);
  }
}

/**
 * End-to-end helper: reserve presigned URL, PUT bytes, return the final
 * image_url. Throws on either step; caller decides how to surface failure.
 */
export async function uploadImage(
  localUri: string,
  meta: { filename: string; size_bytes: number },
): Promise<string> {
  const contentType = detectContentType(meta.filename);
  const reservation = await createUpload({
    filename: meta.filename,
    content_type: contentType,
    size_bytes: meta.size_bytes,
  });
  await uploadFile(localUri, reservation.upload_url, contentType);
  return reservation.image_url;
}
