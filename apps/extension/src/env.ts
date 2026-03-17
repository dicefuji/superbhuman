export const API_BASE_URL =
  import.meta.env.WXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";

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
