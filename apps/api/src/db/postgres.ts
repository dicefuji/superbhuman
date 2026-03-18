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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS backend_sessions (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tracked_messages (
      token TEXT PRIMARY KEY,
      owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      thread_id TEXT,
      message_id TEXT,
      recipient_emails TEXT[] NOT NULL DEFAULT '{}',
      subject TEXT,
      sent_at TIMESTAMPTZ NOT NULL,
      first_opened_at TIMESTAMPTZ,
      last_opened_at TIMESTAMPTZ,
      open_count INTEGER NOT NULL DEFAULT 0,
      last_source_kind TEXT
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS track_open_events (
      id UUID PRIMARY KEY,
      token TEXT NOT NULL REFERENCES tracked_messages(token) ON DELETE CASCADE,
      opened_at TIMESTAMPTZ NOT NULL,
      user_agent TEXT,
      ip_hash TEXT,
      normalized_user_agent TEXT,
      source_kind TEXT,
      ip_fingerprint TEXT
    );
  `);

  await db.query(`ALTER TABLE tracked_messages ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;`);
  await db.query(`ALTER TABLE tracked_messages ADD COLUMN IF NOT EXISTS last_source_kind TEXT;`);
  await db.query(`ALTER TABLE track_open_events ADD COLUMN IF NOT EXISTS normalized_user_agent TEXT;`);
  await db.query(`ALTER TABLE track_open_events ADD COLUMN IF NOT EXISTS source_kind TEXT;`);
  await db.query(`ALTER TABLE track_open_events ADD COLUMN IF NOT EXISTS ip_fingerprint TEXT;`);

  await db.query(`CREATE INDEX IF NOT EXISTS tracked_messages_owner_sent_idx ON tracked_messages (owner_user_id, sent_at DESC, token DESC);`);
  await db.query(`CREATE INDEX IF NOT EXISTS backend_sessions_token_hash_idx ON backend_sessions (token_hash);`);
  await db.query(`CREATE INDEX IF NOT EXISTS track_open_events_token_opened_idx ON track_open_events (token, opened_at DESC);`);
}
