import "server-only";

import type { Feature, LineString } from "geojson";

import type { LatLng } from "@/lib/map-types";
import type { RailwayFeatureCollection } from "@/lib/railway";
export { routeIntersectsRailwayBuffer } from "@/lib/railway";
export type { RailwayFeatureCollection } from "@/lib/railway";

type OverpassWay = {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

type OverpassResponse = {
  elements?: Array<OverpassWay | { type: string; id: number }>;
};

export async function fetchRailways(params: {
  center: LatLng;
  radiusMeters: number;
  endpoint?: string;
}): Promise<RailwayFeatureCollection> {
  const endpoint = (params.endpoint ?? process.env.OVERPASS_ENDPOINT ?? "https://overpass-api.de/api/interpreter").trim();
  const { center, radiusMeters } = params;

  const query = `
[out:json][timeout:25];
(
  way["railway"~"rail|light_rail|subway|tram|narrow_gauge"](around:${Math.round(radiusMeters)},${center.lat},${center.lng});
);
out geom;`.trim();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "application/json" },
    cache: "no-store",
    body: new URLSearchParams({ data: query }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Overpass error ${res.status}: ${text || res.statusText}`);
  }

  const json = (await res.json()) as OverpassResponse;
  const features: Array<Feature<LineString>> = [];

  for (const el of json.elements ?? []) {
    if (!el || (el as OverpassWay).type !== "way") continue;
    const way = el as OverpassWay;
    const geom = way.geometry ?? [];
    if (geom.length < 2) continue;
    features.push({
      type: "Feature",
      properties: { id: way.id, ...(way.tags ?? {}) },
      geometry: {
        type: "LineString",
        coordinates: geom.map((p) => [p.lon, p.lat]),
      },
    });
  }

  return { type: "FeatureCollection", features };
}
