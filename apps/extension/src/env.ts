const trackingApiBaseUrl = import.meta.env.WXT_PUBLIC_TRACKING_API_BASE_URL?.trim();

export const TRACKING_API_BASE_URL = trackingApiBaseUrl ? trackingApiBaseUrl.replace(/\/$/, "") : undefined;
export const TRACKING_BETA_ENABLED =
  import.meta.env.WXT_PUBLIC_ENABLE_TRACKING_BETA === "true" && Boolean(TRACKING_API_BASE_URL);

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
