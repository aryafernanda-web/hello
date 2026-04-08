import * as turf from "@turf/turf";
import type { Feature, LineString, Point } from "geojson";

import type { CablePolyline, LatLng } from "@/lib/map-types";

export type NearestOnLineResult = {
  polyline: CablePolyline;
  nearestPoint: LatLng;
  distanceMeters: number;
  locationAlongLineMeters: number;
  index: number;
};

export function toTurfPoint(p: LatLng): Feature<Point> {
  return turf.point([p.lng, p.lat]);
}

export function toTurfLineString(coords: LatLng[]): Feature<LineString> {
  return turf.lineString(coords.map((c) => [c.lng, c.lat]));
}

export function toGeoJsonPosition(point: LatLng): [number, number] {
  return [point.lng, point.lat];
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  return turf.distance(toTurfPoint(a), toTurfPoint(b), { units: "meters" });
}

export function nearestPointOnLine(user: LatLng, polylines: CablePolyline[]): NearestOnLineResult | null {
  const userPt = toTurfPoint(user);

  let best: NearestOnLineResult | null = null;
  for (const polyline of polylines) {
    if (polyline.coordinates.length < 2) continue;
    const line = toTurfLineString(polyline.coordinates);
    const snapped = turf.nearestPointOnLine(line, userPt, { units: "meters" });
    const dist = typeof snapped.properties?.dist === "number" ? snapped.properties.dist : NaN;
    const location = typeof snapped.properties?.location === "number" ? snapped.properties.location : NaN;
    const index = typeof snapped.properties?.index === "number" ? snapped.properties.index : 0;
    if (!Number.isFinite(dist) || !Number.isFinite(location)) continue;

    const [lng, lat] = snapped.geometry.coordinates;
    const result: NearestOnLineResult = {
      polyline,
      nearestPoint: { lat, lng },
      distanceMeters: dist,
      locationAlongLineMeters: location,
      index,
    };

    if (!best || result.distanceMeters < best.distanceMeters) best = result;
  }

  return best;
}

export function toLeafletLatLngs(
  input: Array<LatLng> | Array<[number, number]> | Array<number[]>
): Array<[number, number]> {
  if (input.length === 0) return [];
  const first = input[0] as unknown;
  if (Array.isArray(first)) {
    // GeoJSON [lng,lat] -> Leaflet [lat,lng]
    return (input as Array<number[]>).map((pos) => [pos[1], pos[0]]);
  }
  return (input as Array<LatLng>).map((p) => [p.lat, p.lng]);
}

export function combineLineCoordinates(
  base: Array<[number, number]> | Array<number[]>,
  extension: Array<[number, number]> | Array<number[]>
): number[][] {
  const merged = [...base.map((coord) => [coord[0], coord[1]]), ...extension.map((coord) => [coord[0], coord[1]])];
  return merged.filter((coord, index, arr) => {
    if (index === 0) return true;
    const prev = arr[index - 1];
    return coord[0] !== prev[0] || coord[1] !== prev[1];
  });
}
