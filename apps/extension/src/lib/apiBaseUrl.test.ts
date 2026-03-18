import { describe, expect, it } from "vitest";

import {
  assertSupportedTrackingApiBaseUrl,
  getTrackingOrigin,
  getTrackingOriginPermissionPattern,
  isTrackingConfigured,
  isLocalApiBaseUrl,
  isPublicHttpsApiBaseUrl,
  normalizeApiBaseUrl,
  resolveApiBaseUrl
} from "./apiBaseUrl";

describe("apiBaseUrl helpers", () => {
  it("normalizes a valid URL and trims the trailing slash", () => {
    expect(normalizeApiBaseUrl("https://example.com/")).toBe("https://example.com");
  });

  it("rejects invalid URLs", () => {
    expect(() => normalizeApiBaseUrl("example.com")).toThrow("Tracking API URL must be a full http:// or https:// URL.");
    expect(() => normalizeApiBaseUrl("ftp://example.com")).toThrow("Tracking API URL must use http:// or https://.");
  });

  it("detects local and public tracking URLs", () => {
    expect(isLocalApiBaseUrl("http://127.0.0.1:8787")).toBe(true);
    expect(isPublicHttpsApiBaseUrl("https://track.example.com")).toBe(true);
    expect(isPublicHttpsApiBaseUrl("http://track.example.com")).toBe(false);
    expect(assertSupportedTrackingApiBaseUrl("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
    expect(() => assertSupportedTrackingApiBaseUrl("http://track.example.com")).toThrow(
      "Use https:// for non-local tracking API URLs."
    );
  });

  it("builds an origin permission pattern", () => {
    expect(getTrackingOrigin("https://track.example.com/path")).toBe("https://track.example.com");
    expect(getTrackingOriginPermissionPattern("https://track.example.com/path")).toBe("https://track.example.com/*");
  });

  it("reflects the build-time tracking configuration", () => {
    if (isTrackingConfigured()) {
      expect(resolveApiBaseUrl()).toMatch(/^https?:\/\//);
      return;
    }

    expect(() => resolveApiBaseUrl()).toThrow("Read statuses are not configured in this build.");
  });
});
