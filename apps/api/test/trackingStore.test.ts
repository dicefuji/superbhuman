import type { TrackRegisterRequest } from "@superbhuman/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { createTrackingStore } from "../src/services/trackingStore";

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
    const store = createTrackingStore();
    await store.register(payload);
    await store.recordOpen({
      token: "abc",
      openedAt: "2026-03-18T00:00:00.000Z"
    });

    await expect(store.getStatus("abc")).resolves.toEqual({
      token: "abc",
      firstOpenedAt: "2026-03-18T00:00:00.000Z",
      lastOpenedAt: "2026-03-18T00:00:00.000Z",
      openCount: 1
    });
  });
});
