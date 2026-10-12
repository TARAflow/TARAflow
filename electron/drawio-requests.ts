// electron/drawio-requests.ts
// ==================== DRAW.IO REQUESTS ====================
// The DFD editor embeds https://embed.diagrams.net in an iframe. Since
// 2026-10 diagrams.net (Cloudflare) answers HTTP 403 when the request carries
// a localhost Referer — measured: the same URL is 200 without it and 403 with
// "Referer: http://localhost:5173/". The dev build always runs on that origin.
//
// 1. The iframe itself sets referrerPolicy="no-referrer" (dfd-tab.tsx).
// 2. Belt and braces here: Referer and Origin are removed from every request
//    to *.diagrams.net, whatever the renderer does.
// 3. Any 4xx/5xx from *.diagrams.net is logged with the headers that tell
//    why (server, cf-mitigated, cf-ray), so a future block is diagnosable from
//    the main-process log instead of a bare "403".
//
// draw.io talks to the app via postMessage (window origins), not via the
// referrer, so dropping it does not affect the bridge.

import type { Session } from "electron";

const DRAWIO_URLS = ["https://*.diagrams.net/*"];

/** Request headers without Referer and Origin (case-insensitive). */
export function withoutReferrer(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (key !== "referer" && key !== "origin") out[k] = v;
  }
  return out;
}

/** Headers worth logging when diagrams.net refuses a request. */
export function blockDiagnostics(
  headers: Record<string, string[] | string> | undefined,
): Record<string, string> {
  const pick = ["server", "cf-mitigated", "cf-ray", "content-type"];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (pick.includes(k.toLowerCase())) out[k.toLowerCase()] = String(v);
  }
  return out;
}

export function configureDrawioRequests(session: Session): void {
  session.webRequest.onBeforeSendHeaders({ urls: DRAWIO_URLS }, (details, callback) => {
    callback({ requestHeaders: withoutReferrer(details.requestHeaders) });
  });

  session.webRequest.onCompleted({ urls: DRAWIO_URLS }, (details) => {
    if (details.statusCode >= 400) {
      console.warn("[Main] draw.io request refused", {
        status: details.statusCode,
        url: details.url.split("?")[0],
        ...blockDiagnostics(details.responseHeaders as Record<string, string[]>),
      });
    }
  });
}
