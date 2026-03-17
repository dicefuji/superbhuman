import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool | undefined {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  return pool;
}

export async function ensureSchema(): Promise<void> {
  const db = getPool();
  if (!db) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS tracked_messages (
      token TEXT PRIMARY KEY,
      thread_id TEXT,
      message_id TEXT,
      recipient_emails TEXT[] NOT NULL DEFAULT '{}',
      subject TEXT,
      sent_at TIMESTAMPTZ NOT NULL,
      first_opened_at TIMESTAMPTZ,
      last_opened_at TIMESTAMPTZ,
      open_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS track_open_events (
      id UUID PRIMARY KEY,
      token TEXT NOT NULL REFERENCES tracked_messages(token) ON DELETE CASCADE,
      opened_at TIMESTAMPTZ NOT NULL,
      user_agent TEXT,
      ip_hash TEXT
    );
  `);
}
