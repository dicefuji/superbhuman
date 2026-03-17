import {
  buildMassArchiveQuery,
  type ArchivePreview,
  type ArchiveThreshold,
  type SplitMode
} from "@superbhuman/shared";

import { gmailBatchModify, gmailListMessages } from "../../lib/gmailApi";
import { getLatestArchiveSnapshot, storeArchiveSnapshot } from "../../lib/storage";

export interface ArchivePreviewOptions {
  threshold: ArchiveThreshold;
  keepUnread: boolean;
  keepStarred: boolean;
  splitMode?: SplitMode;
}

export async function previewMassArchive(options: ArchivePreviewOptions): Promise<ArchivePreview> {
  const query = buildMassArchiveQuery(options);
  const response = await gmailListMessages<{ id: string; threadId: string }>(query, undefined, 25);

  return {
    query,
    total: response.resultSizeEstimate ?? response.messages?.length ?? 0,
    sampleThreadIds: response.messages?.map((message) => message.threadId) ?? [],
    threshold: options.threshold,
    keepUnread: options.keepUnread,
    keepStarred: options.keepStarred,
    generatedAt: new Date().toISOString()
  };
}

export async function runMassArchive(preview: ArchivePreview): Promise<{ archivedCount: number }> {
  let pageToken: string | undefined;
  const messageIds: string[] = [];

  do {
    const response = await gmailListMessages<{ id: string; threadId: string }>(preview.query, pageToken, 500);
    response.messages?.forEach((message) => messageIds.push(message.id));
    pageToken = response.nextPageToken;
  } while (pageToken);

  if (!messageIds.length) {
    return { archivedCount: 0 };
  }

  await gmailBatchModify(messageIds, [], ["INBOX"]);
  await storeArchiveSnapshot({
    id: crypto.randomUUID(),
    query: preview.query,
    messageIds,
    createdAt: new Date().toISOString()
  });

  return { archivedCount: messageIds.length };
}

export async function undoLatestMassArchive(): Promise<{ restoredCount: number }> {
  const snapshot = await getLatestArchiveSnapshot();
  if (!snapshot?.messageIds.length) {
    return { restoredCount: 0 };
  }

  await gmailBatchModify(snapshot.messageIds, ["INBOX"], []);
  return { restoredCount: snapshot.messageIds.length };
}
