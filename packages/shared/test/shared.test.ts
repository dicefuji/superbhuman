import { describe, expect, it } from "vitest";

import {
  buildMassArchiveQuery,
  classifyThread,
  computeSnapshotExpiry,
  extractTrackingToken,
  injectTrackingPixel
} from "../src";

describe("split classification", () => {
  it("prefers explicit sender overrides", () => {
    const result = classifyThread(
      {
        id: "1",
        subject: "Subject",
        sender: "Sender",
        senderEmail: "vip@example.com",
        isUnread: true,
        isImportant: false,
        isStarred: false,
        hasAttachment: false
      },
      [{ sender: "vip@example.com", target: "important", createdAt: "2026-03-17T00:00:00.000Z" }]
    );

    expect(result).toBe("important");
  });
});

describe("mass archive query", () => {
  it("builds a Gmail search query from the chosen options", () => {
    expect(
      buildMassArchiveQuery({
        threshold: "1w",
        keepUnread: true,
        keepStarred: true,
        splitMode: "other"
      })
    ).toBe("in:inbox older_than:7d -is:unread -is:starred -is:important -is:starred");
  });

  it("computes a 7 day expiry", () => {
    expect(computeSnapshotExpiry(new Date("2026-03-17T00:00:00.000Z"))).toBe("2026-03-24T00:00:00.000Z");
  });
});

describe("tracking helpers", () => {
  it("injects and extracts the tracking token", () => {
    const html = injectTrackingPixel("<div>Hello</div>", "https://api.example.com/t/abc.gif", "abc");

    expect(html).toContain('data-superbhuman-track-token="abc"');
    expect(extractTrackingToken(html)).toBe("abc");
  });

  it("extracts a token from a proxied pixel url", () => {
    const html =
      '<img src="https://ci3.googleusercontent.com/proxy/xyz#http://localhost:8787/t/tracked-123.gif" alt="" />';

    expect(extractTrackingToken(html)).toBe("tracked-123");
  });
});
