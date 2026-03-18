import type { TrackRegisterRequest } from "@superbhuman/shared";
import { createHash } from "node:crypto";
import { createServer } from "node:http";

import { ensureSchema } from "./db/postgres.ts";
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
    "Access-Control-Allow-Headers": "Content-Type"
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
        "Access-Control-Allow-Headers": "Content-Type"
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

      if (request.method === "POST" && url.pathname === "/track/register") {
        const payload = await readJson<TrackRegisterRequest>(request);
        await trackingStore.register(payload);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/track/status/")) {
        const token = decodeURIComponent(url.pathname.replace("/track/status/", ""));
        const status = await trackingStore.getStatus(token);
        sendJson(response, status ? 200 : 404, status ?? { error: "Unknown tracking token." });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/t/") && url.pathname.endsWith(".gif")) {
        const token = decodeURIComponent(url.pathname.replace(/^\/t\//, "").replace(/\.gif$/, ""));
        const status = await trackingStore.recordOpen({
          token,
          openedAt: new Date().toISOString(),
          userAgent: request.headers["user-agent"],
          ipHash: request.socket.remoteAddress
            ? createHash("sha256").update(request.socket.remoteAddress).digest("hex")
            : undefined
        });

        sendGif(response, PIXEL_BYTES);
        return status;
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
