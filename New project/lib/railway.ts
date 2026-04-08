import booleanIntersects from "@turf/boolean-intersects";
import buffer from "@turf/buffer";
import type { Feature, FeatureCollection, LineString } from "geojson";

export type RailwayFeatureCollection = FeatureCollection<LineString>;

export function routeIntersectsRailwayBuffer(params: {
  routeLine: Feature<LineString>;
  railways: RailwayFeatureCollection;
  bufferMeters?: number;
}): boolean {
  const bufferMeters = params.bufferMeters ?? 10;
  for (const railway of params.railways.features) {
    const buffered = buffer(railway, bufferMeters, { units: "meters" });
    if (booleanIntersects(params.routeLine, buffered)) return true;
  }
  return false;
}
