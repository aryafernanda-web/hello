import type { LatLng } from "@/lib/map-types";

const LAT_LNG_RE = /(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/;
const MAP_PATH_RE = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/;
const SEARCH_PARAM_KEYS = ["q", "query", "ll", "destination", "daddr"] as const;
const GOOGLE_SHORTLINK_HOSTS = new Set(["goo.gl", "maps.app.goo.gl"]);

function isGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return GOOGLE_SHORTLINK_HOSTS.has(host) || /^(.+\.)?google\.[a-z.]+$/.test(host);
}

function normalizeLatLng(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function parseLatLngText(v: string): LatLng | null {
  const m = v.match(LAT_LNG_RE);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return normalizeLatLng(lat, lng);
}

function parseLatLngFromPath(value: string): LatLng | null {
  const match = value.match(MAP_PATH_RE);
  if (!match) return null;
  return normalizeLatLng(Number(match[1]), Number(match[2]));
}

export function parseLatLngFromGoogleMapsUrl(input: string): LatLng | null {
  const value = input.trim();
  if (!value) return null;

  // Accept raw "lat,lng"
  const direct = parseLatLngText(value);
  if (direct) return direct;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    try {
      url = new URL(value, "https://www.google.com/maps");
    } catch {
      return null;
    }
  }

  for (const key of SEARCH_PARAM_KEYS) {
    const param = url.searchParams.get(key);
    if (!param) continue;

    const fromParam = parseLatLngText(param.replace(/^loc:/i, ""));
    if (fromParam) return fromParam;
  }

  const fromPath = parseLatLngFromPath(url.pathname);
  if (fromPath) return fromPath;

  const fromHash = parseLatLngFromPath(url.hash);
  if (fromHash) return fromHash;

  const fromHref = parseLatLngFromPath(url.href);
  if (fromHref) return fromHref;

  return null;
}

export async function resolveGoogleMapsShortUrl(url: string): Promise<string> {
  const value = url.trim();
  if (!value) throw new Error("URL kosong.");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("URL tidak valid.");
  }

  if (!isGoogleMapsHost(parsed.hostname)) {
    throw new Error("Hanya shortlink atau URL Google Maps yang didukung.");
  }

  const requestInit = {
    redirect: "follow" as const,
    cache: "no-store" as const,
    headers: {
      "User-Agent": "fiber-dp-finder/1.0",
    },
  };

  // Prefer HEAD to reduce payload; fallback to GET for servers that block HEAD.
  const tryHead = async () => {
    const res = await fetch(value, { ...requestInit, method: "HEAD" });
    return res.url || value;
  };

  try {
    return await tryHead();
  } catch {
    const res = await fetch(value, { ...requestInit, method: "GET" });
    return res.url || value;
  }
}
