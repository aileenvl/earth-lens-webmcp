import type { Coordinates } from "../domain/types.ts";
import { normalizeSmnDailyForecast, SMN_DAILY_SOURCE_URL, SMN_DAILY_UPSTREAM_URL } from "./smn.ts";

const CACHE_KEY = "https://earth-lens.internal/cache/smn-daily-v1";
const CACHE_SECONDS = 4_500;
const CLIENT_CACHE_SECONDS = 300;
const MAX_COMPRESSED_BYTES = 2_000_000;
const MAX_DECOMPRESSED_BYTES = 10_000_000;

export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface Options {
  cache?: CacheLike;
  fetchImpl?: typeof fetch;
  now?: () => string;
  timeoutMs?: number;
}

const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), {
  status,
  headers: {
    "cache-control": `public, max-age=${CLIENT_CACHE_SECONDS}`,
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  },
});

const unavailable = (code: string, message: string, fetchedAt: string): Response => json({
  status: "unavailable",
  code,
  message,
  fetchedAt,
  sourceUrl: SMN_DAILY_SOURCE_URL,
});

function coordinatesFrom(request: Request): Coordinates | null {
  const url = new URL(request.url);
  const latitudeInput = url.searchParams.get("latitude");
  const longitudeInput = url.searchParams.get("longitude");
  if (latitudeInput === null || longitudeInput === null || !latitudeInput.trim() || !longitudeInput.trim()) return null;
  const latitude = Number(latitudeInput);
  const longitude = Number(longitudeInput);
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) return null;
  return { latitude, longitude };
}

function cacheResponse(response: Response): Response {
  const headers = new Headers();
  headers.set("cache-control", `public, max-age=${CACHE_SECONDS}`);
  headers.set("content-type", "application/gzip");
  const lastModified = response.headers.get("last-modified");
  if (lastModified) headers.set("last-modified", lastModified);
  return new Response(response.body, { status: 200, headers });
}

async function optionalCacheMatch(cache: CacheLike | undefined, request: Request): Promise<Response | undefined> {
  if (!cache) return undefined;
  try {
    return await cache.match(request);
  } catch {
    return undefined;
  }
}

async function optionalCachePut(cache: CacheLike | undefined, request: Request, response: Response): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(request, response);
  } catch {
    // Hosting caches are an optimization; source availability must not depend on cache permission.
    return;
  }
}

async function decompressedText(response: Response): Promise<string> {
  const compressedLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(compressedLength) && compressedLength > MAX_COMPRESSED_BYTES) {
    throw new Error("SMN compressed response exceeded the accepted size.");
  }
  if (!response.body) throw new Error("SMN returned an empty compressed response.");
  const reader = response.body.pipeThrough(new DecompressionStream("gzip")).getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_DECOMPRESSED_BYTES) {
      await reader.cancel("SMN decompressed response exceeded the accepted size.");
      throw new Error("SMN decompressed response exceeded the accepted size.");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

export async function handleSmnRequest(request: Request, options: Options = {}): Promise<Response> {
  if (request.method !== "GET") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for SMN forecasts." } }, 405);
  const coordinates = coordinatesFrom(request);
  if (!coordinates) return json({ error: { code: "INVALID_COORDINATES", message: "Valid WGS84 latitude and longitude are required." } }, 400);

  const fetchedAt = (options.now ?? (() => new Date().toISOString()))();
  const cacheRequest = new Request(CACHE_KEY);
  let compressed = await optionalCacheMatch(options.cache, cacheRequest);
  if (!compressed) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutMs = options.timeoutMs ?? 20_000;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort("timeout");
    }, timeoutMs);
    try {
      const upstream = await (options.fetchImpl ?? fetch)(SMN_DAILY_UPSTREAM_URL, {
        signal: controller.signal,
        redirect: "follow",
        headers: { accept: "application/octet-stream" },
      });
      if (upstream.url && new URL(upstream.url).hostname !== "smn.conagua.gob.mx") {
        return unavailable("UNEXPECTED_REDIRECT", "SMN redirected outside its official host.", fetchedAt);
      }
      if (!upstream.ok) return unavailable("HTTP_ERROR", `SMN request failed with HTTP ${upstream.status}.`, fetchedAt);
      compressed = cacheResponse(upstream);
      await optionalCachePut(options.cache, cacheRequest, compressed.clone());
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      return unavailable(
        timedOut ? "TIMEOUT" : aborted ? "ABORTED" : "NETWORK_ERROR",
        timedOut ? `SMN did not respond within ${timeoutMs}ms.` : aborted ? "SMN request was cancelled." : "SMN could not be reached.",
        fetchedAt,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  const lastModified = compressed.headers.get("last-modified");
  const parsedLastModified = lastModified ? new Date(lastModified) : null;
  const sourceUpdatedAt = parsedLastModified && !Number.isNaN(parsedLastModified.getTime())
    ? parsedLastModified.toISOString()
    : fetchedAt;
  try {
    const payload = JSON.parse(await decompressedText(compressed));
    return json(normalizeSmnDailyForecast(payload, coordinates, fetchedAt, sourceUpdatedAt));
  } catch {
    return unavailable("INVALID_RESPONSE", "SMN returned an invalid or oversized compressed forecast.", fetchedAt);
  }
}
