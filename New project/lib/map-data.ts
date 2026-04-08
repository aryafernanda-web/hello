import raw from "@/data/map.json";
import { DEFAULT_CENTER } from "@/lib/constants";
import type { CablePolyline, DPMarker, LatLng, MapData, MapMeta } from "@/lib/map-types";

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function normalizeLatLng(v: unknown): LatLng | null {
  if (!v) return null;

  if (Array.isArray(v) && v.length >= 2) {
    const a = asNumber(v[0]);
    const b = asNumber(v[1]);
    if (a === null || b === null) return null;

    const looksLikeLatLng = Math.abs(a) <= 90 && Math.abs(b) > 90;
    const looksLikeLngLat = Math.abs(a) > 90 && Math.abs(b) <= 90;

    if (looksLikeLatLng) return { lat: a, lng: b };
    if (looksLikeLngLat) return { lat: b, lng: a };

    // Fallback: assume [lat,lng]
    return { lat: a, lng: b };
  }

  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const lat = asNumber(obj.lat ?? obj.latitude);
    const lng = asNumber(obj.lng ?? obj.lon ?? obj.longitude);
    if (lat === null || lng === null) return null;
    return { lat, lng };
  }

  return null;
}

function slugId(prefix: string, name: string, fallback: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${base || fallback}`;
}

function normalizeMarker(v: unknown, idx: number): DPMarker | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;
  const name = (obj.name ?? obj.title ?? obj.label ?? `DP ${idx + 1}`) as string;
  const position = normalizeLatLng(obj.position ?? obj.coordinates ?? obj.coord ?? obj);
  if (!position) return null;
  const id = (typeof obj.id === "string" && obj.id.trim() !== "" ? obj.id : slugId("dp", name, String(idx + 1))) as string;
  return { id, name, position };
}

function normalizePolyline(v: unknown, idx: number): CablePolyline | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;
  const name = String(obj.name ?? obj.title ?? obj.label ?? `Jalur Kabel ${idx + 1}`);
  const coordsRaw = obj.coordinates ?? obj.path ?? obj.points ?? obj.geometry ?? obj;
  const coordsArray = Array.isArray(coordsRaw) ? coordsRaw : null;
  if (!coordsArray) return null;
  const coordinates = coordsArray.map(normalizeLatLng).filter((p): p is LatLng => !!p);
  if (coordinates.length < 2) return null;
  const id =
    typeof obj.id === "string" && obj.id.trim() !== "" ? obj.id : slugId("line", name, String(idx + 1));
  return { id, name, coordinates };
}

function normalizeMeta(v: unknown): MapMeta | undefined {
  if (!v || typeof v !== "object") return undefined;

  const obj = v as Record<string, unknown>;
  const areaNameRaw = obj.areaName ?? obj.area ?? obj.name;
  const defaultCenter = normalizeLatLng(obj.defaultCenter ?? obj.center ?? obj.default_position ?? DEFAULT_CENTER);
  if (typeof areaNameRaw !== "string" || !defaultCenter) return undefined;

  return {
    areaName: areaNameRaw,
    defaultCenter,
    source: typeof obj.source === "string" ? obj.source : undefined,
  };
}

function normalizeMapData(v: unknown): MapData {
  const obj = (v ?? {}) as Record<string, unknown>;
  const markersRaw = Array.isArray(obj.markers) ? obj.markers : Array.isArray(obj.dp) ? obj.dp : [];
  const polylinesRaw = Array.isArray(obj.polylines) ? obj.polylines : Array.isArray(obj.lines) ? obj.lines : [];

  const markers = markersRaw.map(normalizeMarker).filter((m): m is DPMarker => !!m);
  const polylines = polylinesRaw.map(normalizePolyline).filter((p): p is CablePolyline => !!p);
  const meta = normalizeMeta(obj.meta);

  return { meta, markers, polylines };
}

export const mapData: MapData = normalizeMapData(raw);
