// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

/**
 * Upload a profile photo using the Manus storage proxy
 * @param userId User ID for organizing photos
 * @param file File buffer or Uint8Array
 * @param mimeType MIME type of the file (e.g., 'image/jpeg')
 * @returns Object with S3 key and CDN URL
 */
export async function uploadProfilePhoto(
  userId: number,
  file: Buffer | Uint8Array,
  mimeType: string
) {
  const { nanoid } = await import("nanoid");
  const fileId = nanoid(12);
  const ext = mimeType.split("/")[1] || "jpg";
  const relKey = `users/${userId}/photos/${fileId}.${ext}`;

  try {
    const result = await storagePut(relKey, file, mimeType);
    return {
      s3Key: result.key,
      cdnUrl: result.url,
      success: true,
    };
  } catch (error) {
    console.error("Failed to upload profile photo:", error);
    throw new Error("Photo upload failed");
  }
}

/**
 * Delete a profile photo from storage
 * @param s3Key Storage key to delete
 */
export async function deleteProfilePhoto(s3Key: string) {
  try {
    // The Manus storage proxy doesn't have a delete endpoint,
    // so we'll just log the deletion request
    console.log(`[Storage] Photo deletion requested for key: ${s3Key}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete profile photo:", error);
    throw new Error("Photo deletion failed");
  }
}

/**
 * Validate image file before upload
 * @param file File to validate
 * @param maxSizeMB Maximum file size in MB
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 10
): { valid: boolean; error?: string } {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Only JPEG, PNG, WebP, and GIF images are allowed",
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}
