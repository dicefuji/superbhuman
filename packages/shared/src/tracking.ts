import type { TrackerStatus } from "./types";

export const TRACKING_TOKEN_PATTERN = /data-superbhuman-track-token="([^"]+)"/i;
export const TRACKING_PIXEL_URL_PATTERN = /(?:\/|%2F)t(?:\/|%2F)([^"'?&#/]+)\.gif/i;

export function buildTrackingPixelUrl(apiBaseUrl: string, token: string): string {
  const base = apiBaseUrl.replace(/\/$/, "");
  return `${base}/t/${encodeURIComponent(token)}.gif`;
}

export function injectTrackingPixel(html: string, pixelUrl: string, token: string): string {
  const tracker = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none !important;" data-superbhuman-track-token="${token}" />`;

  if (html.includes('data-superbhuman-track-token=')) {
    return html.replace(/<img[^>]*data-superbhuman-track-token="[^"]+"[^>]*>/i, tracker);
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${tracker}</body>`);
  }

  return `${html}${tracker}`;
}

export function extractTrackingToken(html: string): string | undefined {
  const directToken = html.match(TRACKING_TOKEN_PATTERN)?.[1];
  if (directToken) {
    return directToken;
  }

  const urlMatch = html.match(TRACKING_PIXEL_URL_PATTERN)?.[1];
  return urlMatch ? decodeURIComponent(urlMatch) : undefined;
}

export function mergeTrackerStatus(statuses: TrackerStatus[]): TrackerStatus | undefined {
  if (!statuses.length) {
    return undefined;
  }

  return statuses.slice(1).reduce<TrackerStatus>((accumulator, current) => {
    const firstOpenedAt =
      accumulator.firstOpenedAt && current.firstOpenedAt
        ? accumulator.firstOpenedAt < current.firstOpenedAt
          ? accumulator.firstOpenedAt
          : current.firstOpenedAt
        : accumulator.firstOpenedAt ?? current.firstOpenedAt;

    const lastOpenedAt =
      accumulator.lastOpenedAt && current.lastOpenedAt
        ? accumulator.lastOpenedAt > current.lastOpenedAt
          ? accumulator.lastOpenedAt
          : current.lastOpenedAt
        : accumulator.lastOpenedAt ?? current.lastOpenedAt;

    return {
      token: accumulator.token,
      firstOpenedAt,
      lastOpenedAt,
      openCount: accumulator.openCount + current.openCount
    };
  }, statuses[0]);
}
