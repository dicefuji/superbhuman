import type { ApiSession } from "@superbhuman/shared";
import { createHash } from "node:crypto";

export function createSession(email: string | undefined, accessToken: string, grantedScopes?: string[]): ApiSession {
  return {
    userId: email
      ? createHash("sha256").update(email).digest("hex").slice(0, 20)
      : createHash("sha256").update(accessToken).digest("hex").slice(0, 20),
    email,
    accessToken,
    expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
    grantedScopes,
    connectedAt: new Date().toISOString()
  };
}
