import { DEFAULT_SPLIT_RULES } from "./defaults";
import type { SplitMode, SplitOverride, ThreadSummary } from "./types";

export function inferDomain(address?: string): string | undefined {
  if (!address || !address.includes("@")) {
    return undefined;
  }

  return address.split("@")[1]?.toLowerCase();
}

export function classifyThread(thread: ThreadSummary, overrides: SplitOverride[]): SplitMode {
  const sender = thread.senderEmail?.toLowerCase();
  const domain = inferDomain(sender);

  const directOverride = overrides.find(
    (override) =>
      (override.sender && sender && override.sender.toLowerCase() === sender) ||
      (override.domain && domain && override.domain.toLowerCase() === domain)
  );

  if (directOverride) {
    return directOverride.target;
  }

  return thread.isImportant || thread.isStarred ? "important" : "other";
}

export function upsertSplitOverride(
  overrides: SplitOverride[],
  override: SplitOverride
): SplitOverride[] {
  const next = overrides.filter((existing) => {
    if (override.sender && existing.sender) {
      return existing.sender.toLowerCase() !== override.sender.toLowerCase();
    }

    if (override.domain && existing.domain) {
      return existing.domain.toLowerCase() !== override.domain.toLowerCase();
    }

    return true;
  });

  next.push(override);
  return next;
}

export function getSplitRule(mode: SplitMode) {
  return DEFAULT_SPLIT_RULES.find((rule) => rule.id === mode) ?? DEFAULT_SPLIT_RULES[0];
}

export function filterThreadsForSplit(
  threads: ThreadSummary[],
  overrides: SplitOverride[],
  mode: SplitMode
): ThreadSummary[] {
  return threads.filter((thread) => classifyThread(thread, overrides) === mode);
}
