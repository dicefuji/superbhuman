const trackingApiBaseUrl = import.meta.env.WXT_PUBLIC_TRACKING_API_BASE_URL?.trim();
const trackingGoogleClientId = import.meta.env.WXT_PUBLIC_TRACKING_GOOGLE_CLIENT_ID?.trim();

export const TRACKING_API_BASE_URL = trackingApiBaseUrl ? trackingApiBaseUrl.replace(/\/$/, "") : undefined;
export const TRACKING_GOOGLE_CLIENT_ID = trackingGoogleClientId || undefined;
export const TRACKING_ENABLED = Boolean(TRACKING_API_BASE_URL && TRACKING_GOOGLE_CLIENT_ID);

export function getPlatform(): "mac" | "windows" | "linux" {
  const navigatorWithUAData = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const value = navigatorWithUAData.userAgentData?.platform ?? navigator.platform;
  const normalized = value.toLowerCase();

  if (normalized.includes("mac")) {
    return "mac";
  }

  if (normalized.includes("win")) {
    return "windows";
  }

  return "linux";
}
