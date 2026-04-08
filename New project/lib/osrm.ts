import "server-only";

import type { LineString } from "geojson";

import type { LatLng } from "@/lib/map-types";

export type OsrmProfile = "driving" | "walking" | "cycling";

export type OsrmRoute = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: LineString;
};

function assertLatLng(v: unknown, label: string): asserts v is LatLng {
  if (!v || typeof v !== "object") throw new Error(`${label} tidak valid.`);
  const obj = v as Record<string, unknown>;
  if (
    typeof obj.lat !== "number" ||
    typeof obj.lng !== "number" ||
    !Number.isFinite(obj.lat) ||
    !Number.isFinite(obj.lng) ||
    Math.abs(obj.lat) > 90 ||
    Math.abs(obj.lng) > 180
  ) {
    throw new Error(`${label} tidak valid.`);
  }
}

export async function fetchOsrmRoute(params: {
  from: LatLng;
  to: LatLng;
  profile?: OsrmProfile;
  baseUrl?: string;
}): Promise<OsrmRoute> {
  const { from, to } = params;
  assertLatLng(from, "from");
  assertLatLng(to, "to");

  const profile: OsrmProfile = params.profile ?? "driving";
  const baseUrl = (params.baseUrl ?? process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org").replace(/\/+$/, "");

  const url = `${baseUrl}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false&annotations=false`;
  const res = await fetch(url, { method: "GET", cache: "no-store", headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OSRM error ${res.status}: ${text || res.statusText}`);
  }

  const json = (await res.json()) as {
    code?: string;
    routes?: Array<{ distance: number; duration: number; geometry: LineString }>;
    message?: string;
  };
  const route = json.routes?.[0];
  if (!route || !route.geometry || typeof route.distance !== "number") {
    throw new Error(json.message || "Respon OSRM tidak valid.");
  }

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry,
  };
}
