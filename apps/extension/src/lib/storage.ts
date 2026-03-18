import {
  computeSnapshotExpiry,
  DEFAULT_PREFERENCES,
  type ArchiveRunSnapshot,
  type TrackedMessageRecord,
  type UserPreferences
} from "@superbhuman/shared";

const PREFERENCES_KEY = "preferences";
const SNAPSHOT_KEY = "massArchiveSnapshots";
const TRACKED_MESSAGES_KEY = "trackedMessages";

export async function loadPreferences(): Promise<UserPreferences> {
  const result = await chrome.storage.sync.get(PREFERENCES_KEY);
  return {
    ...DEFAULT_PREFERENCES,
    ...(result[PREFERENCES_KEY] as Partial<UserPreferences> | undefined)
  };
}

export async function savePreferences(preferences: UserPreferences): Promise<void> {
  await chrome.storage.sync.set({ [PREFERENCES_KEY]: preferences });
}

export async function updatePreferences(
  updater: (current: UserPreferences) => UserPreferences
): Promise<UserPreferences> {
  const current = await loadPreferences();
  const next = updater(current);
  await savePreferences(next);
  return next;
}

export async function storeArchiveSnapshot(
  snapshot: Omit<ArchiveRunSnapshot, "expiresAt">
): Promise<ArchiveRunSnapshot> {
  const result = await chrome.storage.local.get(SNAPSHOT_KEY);
  const snapshots = ((result[SNAPSHOT_KEY] as ArchiveRunSnapshot[] | undefined) ?? []).filter(
    (entry) => new Date(entry.expiresAt).getTime() > Date.now()
  );

  const completeSnapshot: ArchiveRunSnapshot = {
    ...snapshot,
    expiresAt: computeSnapshotExpiry(new Date(snapshot.createdAt))
  };

  snapshots.unshift(completeSnapshot);
  await chrome.storage.local.set({ [SNAPSHOT_KEY]: snapshots.slice(0, 20) });
  return completeSnapshot;
}

export async function getLatestArchiveSnapshot(): Promise<ArchiveRunSnapshot | undefined> {
  const result = await chrome.storage.local.get(SNAPSHOT_KEY);
  const snapshots = (result[SNAPSHOT_KEY] as ArchiveRunSnapshot[] | undefined) ?? [];
  return snapshots.find((snapshot) => new Date(snapshot.expiresAt).getTime() > Date.now());
}

export async function loadTrackedMessages(): Promise<TrackedMessageRecord[]> {
  const result = await chrome.storage.local.get(TRACKED_MESSAGES_KEY);
  const messages = (result[TRACKED_MESSAGES_KEY] as TrackedMessageRecord[] | undefined) ?? [];
  return messages
    .map((message) => ({
      ...message,
      registrationStatus: message.registrationStatus ?? "registered"
    }))
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());
}

export async function upsertTrackedMessage(record: TrackedMessageRecord): Promise<TrackedMessageRecord[]> {
  const current = await loadTrackedMessages();
  const next = current.filter((item) => item.token !== record.token);
  next.unshift(record);
  const trimmed = next.slice(0, 20);
  await chrome.storage.local.set({ [TRACKED_MESSAGES_KEY]: trimmed });
  return trimmed;
}
