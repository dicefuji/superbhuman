import type { TrackOpenEvent, TrackRegisterRequest, TrackerStatus } from "@superbhuman/shared";
import { randomUUID } from "node:crypto";

import { getPool } from "../db/postgres.ts";

export interface TrackingStore {
  register(payload: TrackRegisterRequest): Promise<void>;
  recordOpen(event: TrackOpenEvent): Promise<TrackerStatus>;
  getStatus(token: string): Promise<TrackerStatus | undefined>;
}

class InMemoryTrackingStore implements TrackingStore {
  private readonly messages = new Map<
    string,
    TrackRegisterRequest & {
      firstOpenedAt?: string;
      lastOpenedAt?: string;
      openCount: number;
    }
  >();

  async register(payload: TrackRegisterRequest): Promise<void> {
    const existing = this.messages.get(payload.token);
    this.messages.set(payload.token, {
      ...payload,
      openCount: existing?.openCount ?? 0,
      firstOpenedAt: existing?.firstOpenedAt,
      lastOpenedAt: existing?.lastOpenedAt
    });
  }

  async recordOpen(event: TrackOpenEvent): Promise<TrackerStatus> {
    const existing = this.messages.get(event.token);
    if (!existing) {
      throw new Error("Unknown tracking token.");
    }

    const next = {
      ...existing,
      openCount: existing.openCount + 1,
      firstOpenedAt: existing.firstOpenedAt ?? event.openedAt,
      lastOpenedAt: event.openedAt
    };
    this.messages.set(event.token, next);

    return {
      token: event.token,
      firstOpenedAt: next.firstOpenedAt,
      lastOpenedAt: next.lastOpenedAt,
      openCount: next.openCount
    };
  }

  async getStatus(token: string): Promise<TrackerStatus | undefined> {
    const message = this.messages.get(token);
    if (!message) {
      return undefined;
    }

    return {
      token,
      firstOpenedAt: message.firstOpenedAt,
      lastOpenedAt: message.lastOpenedAt,
      openCount: message.openCount
    };
  }
}

class PostgresTrackingStore implements TrackingStore {
  async register(payload: TrackRegisterRequest): Promise<void> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is not configured.");
    }

    await pool.query(
      `
      INSERT INTO tracked_messages (
        token,
        thread_id,
        message_id,
        recipient_emails,
        subject,
        sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (token) DO UPDATE
      SET thread_id = EXCLUDED.thread_id,
          message_id = EXCLUDED.message_id,
          recipient_emails = EXCLUDED.recipient_emails,
          subject = EXCLUDED.subject,
          sent_at = EXCLUDED.sent_at
    `,
      [
        payload.token,
        payload.threadId ?? null,
        payload.messageId ?? null,
        payload.recipientEmails,
        payload.subject ?? null,
        payload.sentAt
      ]
    );
  }

  async recordOpen(event: TrackOpenEvent): Promise<TrackerStatus> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is not configured.");
    }

    await pool.query(
      `
      INSERT INTO track_open_events (id, token, opened_at, user_agent, ip_hash)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [randomUUID(), event.token, event.openedAt, event.userAgent ?? null, event.ipHash ?? null]
    );

    await pool.query(
      `
      UPDATE tracked_messages
      SET open_count = open_count + 1,
          first_opened_at = COALESCE(first_opened_at, $2),
          last_opened_at = $2
      WHERE token = $1
    `,
      [event.token, event.openedAt]
    );

    const status = await this.getStatus(event.token);
    if (!status) {
      throw new Error("Unknown tracking token.");
    }

    return status;
  }

  async getStatus(token: string): Promise<TrackerStatus | undefined> {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is not configured.");
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

const memoryStore = new InMemoryTrackingStore();

export function createTrackingStore(): TrackingStore {
  return getPool() ? new PostgresTrackingStore() : memoryStore;
}
