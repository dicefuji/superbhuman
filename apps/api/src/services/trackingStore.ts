import type {
  TrackOpenEvent,
  TrackRegisterRequest,
  TrackedMessageRecord,
  TrackerStatus,
  TrackingMessagesPage
} from "@superbhuman/shared";
import { randomUUID } from "node:crypto";

import { getPool } from "../db/postgres.ts";

const DEDUPE_WINDOW_MS = 15 * 60 * 1000;

interface StoredTrackedMessage extends TrackRegisterRequest {
  ownerUserId: string;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  openCount: number;
  lastSourceKind?: TrackOpenEvent["sourceKind"];
}

export interface TrackingStore {
  register(ownerUserId: string, payload: TrackRegisterRequest): Promise<void>;
  recordOpen(event: TrackOpenEvent): Promise<TrackerStatus | undefined>;
  getStatus(ownerUserId: string, token: string): Promise<TrackerStatus | undefined>;
  listMessages(ownerUserId: string, limit?: number, cursor?: string): Promise<TrackingMessagesPage>;
}

function toTrackedMessageRecord(message: StoredTrackedMessage): TrackedMessageRecord {
  return {
    token: message.token,
    threadId: message.threadId,
    messageId: message.messageId,
    recipientEmails: message.recipientEmails,
    subject: message.subject,
    sentAt: message.sentAt,
    registrationStatus: "registered",
    firstOpenedAt: message.firstOpenedAt,
    lastOpenedAt: message.lastOpenedAt,
    openCount: message.openCount,
    lastSourceKind: message.lastSourceKind
  };
}

function encodeCursor(message: { sentAt: string; token: string }): string {
  return Buffer.from(JSON.stringify(message), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string): { sentAt: string; token: string } | undefined {
  if (!cursor) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      sentAt?: string;
      token?: string;
    };
    if (!parsed.sentAt || !parsed.token) {
      return undefined;
    }

    return {
      sentAt: parsed.sentAt,
      token: parsed.token
    };
  } catch {
    return undefined;
  }
}

class InMemoryTrackingStore implements TrackingStore {
  private readonly messages = new Map<string, StoredTrackedMessage>();
  private readonly dedupeKeys = new Map<string, string>();

  async register(ownerUserId: string, payload: TrackRegisterRequest): Promise<void> {
    const existing = this.messages.get(payload.token);
    this.messages.set(payload.token, {
      ...payload,
      ownerUserId,
      openCount: existing?.openCount ?? 0,
      firstOpenedAt: existing?.firstOpenedAt,
      lastOpenedAt: existing?.lastOpenedAt,
      lastSourceKind: existing?.lastSourceKind
    });
  }

  async recordOpen(event: TrackOpenEvent): Promise<TrackerStatus | undefined> {
    const existing = this.messages.get(event.token);
    if (!existing) {
      return undefined;
    }

    const dedupeKey = [
      event.token,
      event.ipFingerprint ?? "",
      event.normalizedUserAgent ?? "",
      event.sourceKind
    ].join(":");
    const previousOpenedAt = this.dedupeKeys.get(dedupeKey);
    if (previousOpenedAt && new Date(event.openedAt).getTime() - new Date(previousOpenedAt).getTime() < DEDUPE_WINDOW_MS) {
      return {
        token: existing.token,
        firstOpenedAt: existing.firstOpenedAt,
        lastOpenedAt: existing.lastOpenedAt,
        openCount: existing.openCount
      };
    }

    this.dedupeKeys.set(dedupeKey, event.openedAt);
    const next: StoredTrackedMessage = {
      ...existing,
      openCount: existing.openCount + 1,
      firstOpenedAt: existing.firstOpenedAt ?? event.openedAt,
      lastOpenedAt: event.openedAt,
      lastSourceKind: event.sourceKind
    };
    this.messages.set(event.token, next);

    return {
      token: next.token,
      firstOpenedAt: next.firstOpenedAt,
      lastOpenedAt: next.lastOpenedAt,
      openCount: next.openCount
    };
  }

  async getStatus(ownerUserId: string, token: string): Promise<TrackerStatus | undefined> {
    const message = this.messages.get(token);
    if (!message || message.ownerUserId !== ownerUserId) {
      return undefined;
    }

    return {
      token,
      firstOpenedAt: message.firstOpenedAt,
      lastOpenedAt: message.lastOpenedAt,
      openCount: message.openCount
    };
  }

  async listMessages(ownerUserId: string, limit = 20, cursor?: string): Promise<TrackingMessagesPage> {
    const sorted = Array.from(this.messages.values())
      .filter((message) => message.ownerUserId === ownerUserId)
      .sort((left, right) => {
        const sentAtDiff = new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime();
        if (sentAtDiff !== 0) {
          return sentAtDiff;
        }

        return right.token.localeCompare(left.token);
      });

    const decodedCursor = decodeCursor(cursor);
    const startIndex = decodedCursor
      ? sorted.findIndex(
          (message) => message.sentAt === decodedCursor.sentAt && message.token === decodedCursor.token
        ) + 1
      : 0;

    const slice = sorted.slice(Math.max(startIndex, 0), Math.max(startIndex, 0) + limit + 1);
    const hasNextPage = slice.length > limit;
    const items = (hasNextPage ? slice.slice(0, limit) : slice).map(toTrackedMessageRecord);
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor: hasNextPage && lastItem ? encodeCursor({ sentAt: lastItem.sentAt, token: lastItem.token }) : undefined
    };
  }
}

class PostgresTrackingStore implements TrackingStore {
  async register(ownerUserId: string, payload: TrackRegisterRequest): Promise<void> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is required for hosted read statuses.");
    }

    await pool.query(
      `
      INSERT INTO tracked_messages (
        token,
        owner_user_id,
        thread_id,
        message_id,
        recipient_emails,
        subject,
        sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (token) DO UPDATE
      SET owner_user_id = EXCLUDED.owner_user_id,
          thread_id = EXCLUDED.thread_id,
          message_id = EXCLUDED.message_id,
          recipient_emails = EXCLUDED.recipient_emails,
          subject = EXCLUDED.subject,
          sent_at = EXCLUDED.sent_at
    `,
      [
        payload.token,
        ownerUserId,
        payload.threadId ?? null,
        payload.messageId ?? null,
        payload.recipientEmails,
        payload.subject ?? null,
        payload.sentAt
      ]
    );
  }

  async recordOpen(event: TrackOpenEvent): Promise<TrackerStatus | undefined> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is required for hosted read statuses.");
    }

    const trackedMessageResult = await pool.query<{
      token: string;
      first_opened_at: string | null;
      last_opened_at: string | null;
      open_count: number;
    }>(
      `
      SELECT token, first_opened_at, last_opened_at, open_count
      FROM tracked_messages
      WHERE token = $1
      LIMIT 1
    `,
      [event.token]
    );

    const trackedMessage = trackedMessageResult.rows[0];
    if (!trackedMessage) {
      return undefined;
    }

    const duplicateResult = await pool.query<{ opened_at: string }>(
      `
      SELECT opened_at
      FROM track_open_events
      WHERE token = $1
        AND COALESCE(ip_fingerprint, '') = COALESCE($2, '')
        AND COALESCE(normalized_user_agent, '') = COALESCE($3, '')
        AND source_kind = $4
        AND opened_at >= ($5::timestamptz - INTERVAL '15 minutes')
      ORDER BY opened_at DESC
      LIMIT 1
    `,
      [event.token, event.ipFingerprint ?? null, event.normalizedUserAgent ?? null, event.sourceKind, event.openedAt]
    );

    if (duplicateResult.rows[0]) {
      return {
        token: trackedMessage.token,
        firstOpenedAt: trackedMessage.first_opened_at ?? undefined,
        lastOpenedAt: trackedMessage.last_opened_at ?? undefined,
        openCount: trackedMessage.open_count
      };
    }

    await pool.query(
      `
      INSERT INTO track_open_events (
        id,
        token,
        opened_at,
        normalized_user_agent,
        source_kind,
        ip_fingerprint
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [randomUUID(), event.token, event.openedAt, event.normalizedUserAgent ?? null, event.sourceKind, event.ipFingerprint ?? null]
    );

    await pool.query(
      `
      UPDATE tracked_messages
      SET open_count = open_count + 1,
          first_opened_at = COALESCE(first_opened_at, $2),
          last_opened_at = $2,
          last_source_kind = $3
      WHERE token = $1
    `,
      [event.token, event.openedAt, event.sourceKind]
    );

    return this.getStatusByToken(event.token);
  }

  async getStatus(ownerUserId: string, token: string): Promise<TrackerStatus | undefined> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is required for hosted read statuses.");
    }

    const result = await pool.query<{
      first_opened_at: string | null;
      last_opened_at: string | null;
      open_count: number;
    }>(
      `
      SELECT first_opened_at, last_opened_at, open_count
      FROM tracked_messages
      WHERE token = $1
        AND owner_user_id = $2
      LIMIT 1
    `,
      [token, ownerUserId]
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return {
      token,
      firstOpenedAt: row.first_opened_at ?? undefined,
      lastOpenedAt: row.last_opened_at ?? undefined,
      openCount: row.open_count
    };
  }

  async listMessages(ownerUserId: string, limit = 20, cursor?: string): Promise<TrackingMessagesPage> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is required for hosted read statuses.");
    }

    const decodedCursor = decodeCursor(cursor);
    const result = await pool.query<{
      token: string;
      thread_id: string | null;
      message_id: string | null;
      recipient_emails: string[];
      subject: string | null;
      sent_at: string;
      first_opened_at: string | null;
      last_opened_at: string | null;
      open_count: number;
      last_source_kind: TrackOpenEvent["sourceKind"] | null;
    }>(
      `
      SELECT token, thread_id, message_id, recipient_emails, subject, sent_at, first_opened_at, last_opened_at, open_count, last_source_kind
      FROM tracked_messages
      WHERE owner_user_id = $1
        AND (
          $2::timestamptz IS NULL
          OR sent_at < $2
          OR (sent_at = $2 AND token < COALESCE($3, ''))
        )
      ORDER BY sent_at DESC, token DESC
      LIMIT $4
    `,
      [ownerUserId, decodedCursor?.sentAt ?? null, decodedCursor?.token ?? null, limit + 1]
    );

    const hasNextPage = result.rows.length > limit;
    const rows = hasNextPage ? result.rows.slice(0, limit) : result.rows;
    const items: TrackedMessageRecord[] = rows.map((row) => ({
      token: row.token,
      threadId: row.thread_id ?? undefined,
      messageId: row.message_id ?? undefined,
      recipientEmails: row.recipient_emails,
      subject: row.subject ?? undefined,
      sentAt: row.sent_at,
      firstOpenedAt: row.first_opened_at ?? undefined,
      lastOpenedAt: row.last_opened_at ?? undefined,
      openCount: row.open_count,
      registrationStatus: "registered",
      lastSourceKind: row.last_source_kind ?? undefined
    }));
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor: hasNextPage && lastItem ? encodeCursor({ sentAt: lastItem.sentAt, token: lastItem.token }) : undefined
    };
  }

  private async getStatusByToken(token: string): Promise<TrackerStatus | undefined> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is required for hosted read statuses.");
    }

    const result = await pool.query<{
      first_opened_at: string | null;
      last_opened_at: string | null;
      open_count: number;
    }>(
      `
      SELECT first_opened_at, last_opened_at, open_count
      FROM tracked_messages
      WHERE token = $1
      LIMIT 1
    `,
      [token]
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return {
      token,
      firstOpenedAt: row.first_opened_at ?? undefined,
      lastOpenedAt: row.last_opened_at ?? undefined,
      openCount: row.open_count
    };
  }
}

export function createInMemoryTrackingStore(): TrackingStore {
  return new InMemoryTrackingStore();
}

export function createTrackingStore(): TrackingStore {
  if (!getPool()) {
    throw new Error("DATABASE_URL is required for hosted read statuses.");
  }

  return new PostgresTrackingStore();
}
