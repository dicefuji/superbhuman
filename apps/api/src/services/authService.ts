import type { TrackingSession } from "@superbhuman/shared";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getPool } from "../db/postgres.ts";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const SESSION_TTL_DAYS = Number(process.env.TRACKING_SESSION_TTL_DAYS ?? 30);

export interface TrackingAuthExchangeRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface StoredTrackingSession {
  sessionToken: string;
  session: TrackingSession;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getTrackingPool() {
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL is required for hosted read statuses.");
  }

  return pool;
}

function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

async function fetchGoogleUserInfo(request: TrackingAuthExchangeRequest): Promise<GoogleUserInfoResponse> {
  const googleClientId = getRequiredEnv("TRACKING_GOOGLE_OAUTH_CLIENT_ID");
  const googleClientSecret = getRequiredEnv("TRACKING_GOOGLE_OAUTH_CLIENT_SECRET");

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code: request.code,
      code_verifier: request.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: request.redirectUri
    })
  });

  if (!tokenResponse.ok) {
    const message = await tokenResponse.text();
    throw new Error(`Google tracking auth exchange failed: ${message || tokenResponse.status}`);
  }

  const tokenJson = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Google tracking auth exchange did not return an access token.");
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`
    }
  });

  if (!userInfoResponse.ok) {
    const message = await userInfoResponse.text();
    throw new Error(`Google userinfo lookup failed: ${message || userInfoResponse.status}`);
  }

  return userInfoResponse.json() as Promise<GoogleUserInfoResponse>;
}

export async function exchangeTrackingGoogleCode(
  request: TrackingAuthExchangeRequest
): Promise<StoredTrackingSession> {
  const userInfo = await fetchGoogleUserInfo(request);
  if (!userInfo.sub || !userInfo.email || !userInfo.email_verified) {
    throw new Error("Google tracking auth did not return a verified email address.");
  }

  const pool = getTrackingPool();
  await pool.query(
    `
    INSERT INTO users (id, email, email_verified, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        email_verified = EXCLUDED.email_verified,
        updated_at = NOW()
  `,
    [userInfo.sub, userInfo.email, true]
  );

  const sessionToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const connectedAt = new Date().toISOString();

  await pool.query(
    `
    INSERT INTO backend_sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
    VALUES ($1, $2, $3, $4, $4, $5)
  `,
    [randomUUID(), userInfo.sub, tokenHash, connectedAt, expiresAt]
  );

  return {
    sessionToken,
    session: {
      userId: userInfo.sub,
      email: userInfo.email,
      connectedAt,
      expiresAt
    }
  };
}

export async function getTrackingSession(sessionToken: string): Promise<TrackingSession | null> {
  const pool = getTrackingPool();
  const tokenHash = hashSessionToken(sessionToken);

  const result = await pool.query<{
    user_id: string;
    email: string;
    created_at: string;
    expires_at: string;
  }>(
    `
    SELECT backend_sessions.user_id, users.email, backend_sessions.created_at, backend_sessions.expires_at
    FROM backend_sessions
    INNER JOIN users ON users.id = backend_sessions.user_id
    WHERE backend_sessions.token_hash = $1
      AND backend_sessions.expires_at > NOW()
    LIMIT 1
  `,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  await pool.query(
    `
    UPDATE backend_sessions
    SET last_seen_at = NOW()
    WHERE token_hash = $1
  `,
    [tokenHash]
  );

  return {
    userId: row.user_id,
    email: row.email,
    connectedAt: row.created_at,
    expiresAt: row.expires_at
  };
}

export async function revokeTrackingSession(sessionToken: string): Promise<void> {
  const pool = getTrackingPool();
  const tokenHash = hashSessionToken(sessionToken);

  await pool.query(
    `
    DELETE FROM backend_sessions
    WHERE token_hash = $1
  `,
    [tokenHash]
  );
}
