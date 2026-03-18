import type { TrackRegisterRequest } from "@superbhuman/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { createInMemoryTrackingStore } from "../src/services/trackingStore";

describe("tracking store", () => {
  const payload: TrackRegisterRequest = {
    token: "abc",
    recipientEmails: ["hello@example.com"],
    sentAt: "2026-03-17T00:00:00.000Z",
    subject: "Subject"
  };

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("registers and returns open statistics", async () => {
    const store = createInMemoryTrackingStore();
    await store.register("user-1", payload);
    await store.recordOpen({
      token: "abc",
      openedAt: "2026-03-18T00:00:00.000Z",
      normalizedUserAgent: "gmail-image-proxy",
      ipFingerprint: "fingerprint-1",
      sourceKind: "gmail_proxy"
    });

    await expect(store.getStatus("user-1", "abc")).resolves.toEqual({
      token: "abc",
      firstOpenedAt: "2026-03-18T00:00:00.000Z",
      lastOpenedAt: "2026-03-18T00:00:00.000Z",
      openCount: 1
    });
  });

  it("deduplicates rapid repeat opens for the same fingerprint and source", async () => {
    const store = createInMemoryTrackingStore();
    await store.register("user-dedupe", {
      ...payload,
      token: "dedupe-token"
    });

    await store.recordOpen({
      token: "dedupe-token",
      openedAt: "2026-03-18T00:00:00.000Z",
      normalizedUserAgent: "gmail-image-proxy",
      ipFingerprint: "fingerprint-1",
      sourceKind: "gmail_proxy"
    });
    await store.recordOpen({
      token: "dedupe-token",
      openedAt: "2026-03-18T00:05:00.000Z",
      normalizedUserAgent: "gmail-image-proxy",
      ipFingerprint: "fingerprint-1",
      sourceKind: "gmail_proxy"
    });

    await expect(store.getStatus("user-dedupe", "dedupe-token")).resolves.toEqual({
      token: "dedupe-token",
      firstOpenedAt: "2026-03-18T00:00:00.000Z",
      lastOpenedAt: "2026-03-18T00:00:00.000Z",
      openCount: 1
    });
  });

  it("scopes message access to the owning user", async () => {
    const store = createInMemoryTrackingStore();
    await store.register("owner-a", {
      ...payload,
      token: "owner-token"
    });

    await expect(store.getStatus("owner-b", "owner-token")).resolves.toBeUndefined();

    const page = await store.listMessages("owner-b");
    expect(page.items).toEqual([]);
  });
});
