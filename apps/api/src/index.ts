import type { TrackOpenEvent, TrackRegisterRequest } from "@superbhuman/shared";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

import { ensureSchema } from "./db/postgres.ts";
import {
  exchangeTrackingGoogleCode,
  getTrackingSession,
  revokeTrackingSession,
  type TrackingAuthExchangeRequest
} from "./services/authService.ts";
import { createTrackingStore } from "./services/trackingStore.ts";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const trackingStore = createTrackingStore();

const PIXEL_BYTES = Buffer.from("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  response.end(JSON.stringify(body));
}

function sendGif(response: import("node:http").ServerResponse, bytes: Buffer) {
  response.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(bytes);
}

function readJson<T>(request: import("node:http").IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function getBearerToken(request: import("node:http").IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim() || undefined;
}

async function requireTrackingSession(request: import("node:http").IncomingMessage) {
  const sessionToken = getBearerToken(request);
  if (!sessionToken) {
    return null;
  }

  return getTrackingSession(sessionToken);
}

function normalizeUserAgent(value: string | string[] | undefined): string | undefined {
  const userAgent = Array.isArray(value) ? value[0] : value;
  const normalized = userAgent?.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 512) : undefined;
}

function classifySourceKind(normalizedUserAgent?: string): TrackOpenEvent["sourceKind"] {
  if (!normalizedUserAgent) {
    return "unknown";
  }

  if (normalizedUserAgent.includes("googleimageproxy")) {
    return "gmail_proxy";
  }

  if (
    normalizedUserAgent === "mozilla/5.0" ||
    (normalizedUserAgent.includes("applewebkit") &&
      !normalizedUserAgent.includes("safari") &&
      !normalizedUserAgent.includes("chrome") &&
      !normalizedUserAgent.includes("googleimageproxy"))
  ) {
    return "apple_privacy";
  }

  return "mail_client";
}

function fingerprintIp(request: import("node:http").IncomingMessage): string | undefined {
  const forwardedFor = request.headers["x-forwarded-for"];
  const clientIp =
    typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim()
      : request.socket.remoteAddress ?? undefined;

  if (!clientIp) {
    return undefined;
  }

  const secret = process.env.TRACKING_EVENT_SECRET ?? "dev-tracking-event-secret";
  return createHmac("sha256", secret).update(clientIp).digest("hex");
}

async function main() {
  await ensureSchema();

  const server = createServer(async (request, response) => {
    if (!request.url) {
      sendJson(response, 400, { error: "Missing request URL." });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      });
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    try {
      if (request.method === "GET" && url.pathname === "/healthz") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/auth/google/exchange") {
        const payload = await readJson<TrackingAuthExchangeRequest>(request);
        const exchange = await exchangeTrackingGoogleCode(payload);
        sendJson(response, 200, exchange);
        return;
      }

      if (request.method === "GET" && url.pathname === "/auth/session") {
        const session = await requireTrackingSession(request);
        if (!session) {
          sendJson(response, 401, { error: "Tracking session not found." });
          return;
        }

        sendJson(response, 200, session);
        return;
      }

      if (request.method === "POST" && url.pathname === "/auth/logout") {
        const sessionToken = getBearerToken(request);
        if (sessionToken) {
          await revokeTrackingSession(sessionToken);
        }

        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/track/register") {
        const session = await requireTrackingSession(request);
        if (!session) {
          sendJson(response, 401, { error: "Enable Read Statuses before tracking opens." });
          return;
        }

        const payload = await readJson<TrackRegisterRequest>(request);
        await trackingStore.register(session.userId, payload);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/track/messages") {
        const session = await requireTrackingSession(request);
        if (!session) {
          sendJson(response, 401, { error: "Enable Read Statuses before loading tracked messages." });
          return;
        }

        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const page = await trackingStore.listMessages(session.userId, limit, cursor);
        sendJson(response, 200, page);
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/track/status/")) {
        const session = await requireTrackingSession(request);
        if (!session) {
          sendJson(response, 401, { error: "Enable Read Statuses before loading tracking status." });
          return;
        }

        const token = decodeURIComponent(url.pathname.replace("/track/status/", ""));
        const status = await trackingStore.getStatus(session.userId, token);
        sendJson(response, status ? 200 : 404, status ?? { error: "Unknown tracking token." });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/t/") && url.pathname.endsWith(".gif")) {
        const token = decodeURIComponent(url.pathname.replace(/^\/t\//, "").replace(/\.gif$/, ""));
        const normalizedUserAgent = normalizeUserAgent(request.headers["user-agent"]);

        try {
          await trackingStore.recordOpen({
            token,
            openedAt: new Date().toISOString(),
            normalizedUserAgent,
            sourceKind: classifySourceKind(normalizedUserAgent),
            ipFingerprint: fingerprintIp(request)
          });
        } catch (error) {
          console.error("track_open_failed", {
            token,
            error: error instanceof Error ? error.message : error
          });
        }

        sendGif(response, PIXEL_BYTES);
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error."
      });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`superbhuman-api listening on http://${HOST}:${PORT}`);
  });
}

void main();
