import { classifyThread, inferDomain, type SplitMode, type SplitOverride } from "@superbhuman/shared";

import type { GmailDomAdapter, ThreadRowSnapshot } from "../gmail/domAdapter";

export function applySplitMode(
  adapter: GmailDomAdapter,
  mode: SplitMode,
  overrides: SplitOverride[]
): ThreadRowSnapshot[] {
  const threads = adapter.getThreadRows();

  for (const thread of threads) {
    const classification = classifyThread(thread, overrides);
    const match = classification === mode;
    thread.element.dataset.superbhumanSplit = classification;
    thread.element.classList.toggle("sb-hidden-row", !match);
  }

  return threads.filter((thread) => !thread.element.classList.contains("sb-hidden-row"));
}

export function getSplitCounts(threads: ThreadRowSnapshot[], overrides: SplitOverride[]) {
  return threads.reduce(
    (accumulator, thread) => {
      const classification = classifyThread(thread, overrides);
      accumulator[classification] += 1;
      return accumulator;
    },
    {
      important: 0,
      other: 0
    } satisfies Record<SplitMode, number>
  );
}

export function buildOverrideForThread(thread: ThreadRowSnapshot, target: SplitMode): SplitOverride | undefined {
  if (thread.senderEmail) {
    return {
      sender: thread.senderEmail.toLowerCase(),
      target,
      createdAt: new Date().toISOString()
    };
  }

  const domain = inferDomain(thread.sender);
  if (domain) {
    return {
      domain,
      target,
      createdAt: new Date().toISOString()
    };
  }

  return undefined;
}
