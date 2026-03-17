import type { ArchiveThreshold } from "./types";

export const ARCHIVE_THRESHOLDS: Record<ArchiveThreshold, { label: string; queryFragment: string }> = {
  "1d": { label: "1 day", queryFragment: "older_than:1d" },
  "3d": { label: "3 days", queryFragment: "older_than:3d" },
  "1w": { label: "1 week", queryFragment: "older_than:7d" },
  "2w": { label: "2 weeks", queryFragment: "older_than:14d" },
  "1m": { label: "1 month", queryFragment: "older_than:30d" }
};

export interface BuildMassArchiveQueryOptions {
  threshold: ArchiveThreshold;
  keepUnread: boolean;
  keepStarred: boolean;
  splitMode?: "important" | "other";
}

export function buildMassArchiveQuery(options: BuildMassArchiveQueryOptions): string {
  const fragments = ["in:inbox", ARCHIVE_THRESHOLDS[options.threshold].queryFragment];

  if (options.keepUnread) {
    fragments.push("-is:unread");
  }

  if (options.keepStarred) {
    fragments.push("-is:starred");
  }

  if (options.splitMode === "important") {
    fragments.push("(is:important OR is:starred)");
  }

  if (options.splitMode === "other") {
    fragments.push("-is:important", "-is:starred");
  }

  return fragments.join(" ");
}

export function computeSnapshotExpiry(createdAt: Date): string {
  const expiry = new Date(createdAt);
  expiry.setDate(expiry.getDate() + 7);
  return expiry.toISOString();
}
