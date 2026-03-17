import { DEFAULT_PREFERENCES, type UserPreferences } from "@superbhuman/shared";

import { API_BASE_URL } from "../env";

export function normalizeApiBaseUrl(value?: string): string {
  return (value ?? DEFAULT_PREFERENCES.apiBaseUrl ?? API_BASE_URL).trim().replace(/\/$/, "");
}

export function resolveApiBaseUrl(preferences?: Pick<UserPreferences, "apiBaseUrl">): string {
  return normalizeApiBaseUrl(preferences?.apiBaseUrl || API_BASE_URL);
}

export function isLocalApiBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}
