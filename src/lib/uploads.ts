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
 * End-to-end image upload helper:
 *   1) Read the local file once to derive real size_bytes (expo-image-picker
 *      omits fileSize on iOS in many cases, and the server enforces gt=0).
 *   2) Reserve a presigned S3 URL with the accurate metadata.
 *   3) PUT the same blob to that URL.
 *   4) Return the canonical CloudFront image_url.
 * Throws ApiError on either step; caller decides how to surface failure.
 */
export async function uploadImage(
  localUri: string,
  filename: string,
): Promise<string> {
  const contentType = detectContentType(filename);

  // RN's fetch resolves file:// URIs transparently. Read as ArrayBuffer
  // (NOT Blob) — RN's XHR layer rejects Blob as a PUT body with
  // "Only ArrayBuffer and ArrayBufferView supported for binary data".
  // ArrayBuffer is what S3's presigned PUT actually expects anyway.
  const fileRes = await fetch(localUri);
  const buffer = await fileRes.arrayBuffer();
  const sizeBytes = buffer.byteLength;
  if (!sizeBytes) {
    throw new ApiError(0, 'empty file');
  }

  const reservation = await createUpload({
    filename,
    content_type: contentType,
    size_bytes: sizeBytes,
  });

  const putRes = await fetch(reservation.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buffer,
  });
  if (!putRes.ok) {
    throw new ApiError(
      putRes.status,
      `S3 PUT failed: ${putRes.statusText || putRes.status}`,
    );
  }

  return reservation.image_url;
}
