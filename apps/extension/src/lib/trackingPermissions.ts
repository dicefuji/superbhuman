import {
  assertSupportedTrackingApiBaseUrl,
  getTrackingOrigin,
  getTrackingOriginPermissionPattern,
  isLocalApiBaseUrl
} from "./apiBaseUrl";

export async function hasTrackingOriginPermission(apiBaseUrl: string): Promise<boolean> {
  const normalizedUrl = assertSupportedTrackingApiBaseUrl(apiBaseUrl);
  if (isLocalApiBaseUrl(normalizedUrl)) {
    return true;
  }

  return chrome.permissions.contains({
    origins: [getTrackingOriginPermissionPattern(normalizedUrl)]
  });
}

export async function ensureTrackingOriginPermission(apiBaseUrl: string): Promise<{
  granted: boolean;
  origin?: string;
}> {
  const normalizedUrl = assertSupportedTrackingApiBaseUrl(apiBaseUrl);
  const origin = getTrackingOrigin(normalizedUrl);

  if (isLocalApiBaseUrl(normalizedUrl)) {
    return {
      granted: true,
      origin
    };
  }

  const pattern = getTrackingOriginPermissionPattern(normalizedUrl);
  const alreadyGranted = await chrome.permissions.contains({
    origins: [pattern]
  });

  if (alreadyGranted) {
    return {
      granted: true,
      origin
    };
  }

  const granted = await chrome.permissions.request({
    origins: [pattern]
  });

  return {
    granted,
    origin: granted ? origin : undefined
  };
}
