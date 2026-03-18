import { TRACKING_API_BASE_URL, TRACKING_ENABLED } from "../env";

export function normalizeApiBaseUrl(value?: string): string {
  const rawValue = value?.trim();

  if (!rawValue) {
    throw new Error("Read statuses are not configured in this build.");
  }

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("Tracking API URL must be a full http:// or https:// URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Tracking API URL must use http:// or https://.");
  }

  return url.toString().replace(/\/$/, "");
}

export function isTrackingConfigured(): boolean {
  return TRACKING_ENABLED;
}

export function resolveApiBaseUrl(): string {
  return assertSupportedTrackingApiBaseUrl(TRACKING_API_BASE_URL);
}

export function isLocalApiBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function isPublicHttpsApiBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isLocalApiBaseUrl(value);
  } catch {
    return false;
  }
}

export function getTrackingOrigin(value: string): string {
  return new URL(normalizeApiBaseUrl(value)).origin;
}

export function getTrackingOriginPermissionPattern(value: string): string {
  return `${getTrackingOrigin(value)}/*`;
}

export function assertSupportedTrackingApiBaseUrl(value?: string): string {
  const normalized = normalizeApiBaseUrl(value);
  if (isLocalApiBaseUrl(normalized) || isPublicHttpsApiBaseUrl(normalized)) {
    return normalized;
  }

  throw new Error("Use https:// for non-local tracking API URLs.");
}
