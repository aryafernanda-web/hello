import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, LineString } from "geojson";

export type RailwayFeatureCollection = FeatureCollection<LineString>;

export function routeIntersectsRailwayBuffer(params: {
  routeLine: Feature<LineString>;
  railways: RailwayFeatureCollection;
  bufferMeters?: number;
}): boolean {
  const bufferMeters = params.bufferMeters ?? 10;
  for (const railway of params.railways.features) {
    const buffered = turf.buffer(railway, bufferMeters, { units: "meters" });
    if (turf.booleanIntersects(params.routeLine, buffered)) return true;
  }
  return false;
}

