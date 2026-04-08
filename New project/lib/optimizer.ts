import * as turf from "@turf/turf";
import type { Feature, LineString } from "geojson";

import {
  CABLE_SNAP_THRESHOLD_METERS,
  DEFAULT_CANDIDATE_LIMIT,
  DEFAULT_RAILWAY_BUFFER_METERS,
  DEFAULT_RAILWAY_RADIUS_METERS,
  DP_SNAP_TO_CABLE_MAX_METERS,
} from "@/lib/constants";
import {
  combineLineCoordinates,
  distanceMeters,
  nearestPointOnLine,
  toGeoJsonPosition,
  toTurfLineString,
  toTurfPoint,
} from "@/lib/geo";
import type { CablePolyline, DPMarker, LatLng } from "@/lib/map-types";
import type { RailwayFeatureCollection } from "@/lib/railway";
import { routeIntersectsRailwayBuffer } from "@/lib/railway";

export type RouteOverlay = {
  distanceMeters: number;
  durationSeconds?: number;
  geometry: LineString;
};

export type CandidateResult = {
  dp: DPMarker;
  mode: "DIRECT_ROAD" | "ROAD_TO_CABLE";
  straightDistanceMeters: number;
  roadDistanceMeters: number;
  cableDistanceMeters: number;
  totalDistanceMeters: number;
  rejectedByRailway: boolean;
  roadRoute: RouteOverlay | null;
  cableRoute: RouteOverlay | null;
};

export type OptimizationResult = {
  user: LatLng;
  cableSnap:
    | {
        isNearCable: true;
        distanceMeters: number;
        point: LatLng;
        polylineId: string;
        polylineName: string;
      }
    | {
        isNearCable: false;
      };
  railways: RailwayFeatureCollection | null;
  candidates: CandidateResult[];
  best: CandidateResult | null;
  warnings: string[];
};

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string };

function makeLineFeature(geometry: LineString): Feature<LineString> {
  return { type: "Feature", properties: {}, geometry };
}

function makeRouteOverlay(geometry: LineString, distanceMeters: number, durationSeconds?: number): RouteOverlay {
  return {
    geometry,
    distanceMeters,
    durationSeconds,
  };
}

function sortCandidates(a: CandidateResult, b: CandidateResult): number {
  return Number(a.rejectedByRailway) - Number(b.rejectedByRailway) || a.totalDistanceMeters - b.totalDistanceMeters;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!json) throw new Error(`API ${url} mengembalikan respon kosong.`);
  return json;
}

async function fetchRoadRoute(from: LatLng, to: LatLng): Promise<RouteOverlay> {
  const json = await postJson<ApiOk<{ route: RouteOverlay }> | ApiErr>("/api/routing", { from, to });
  if (!json.ok) throw new Error(json.error);
  return json.route;
}

async function fetchRailways(center: LatLng, radiusMeters: number): Promise<RailwayFeatureCollection> {
  const json = await postJson<ApiOk<{ railways: RailwayFeatureCollection }> | ApiErr>("/api/overpass", {
    center,
    radiusMeters,
  });
  if (!json.ok) throw new Error(json.error);
  return json.railways;
}

function buildCableRouteOverlay(params: {
  cableLine: Feature<LineString>;
  startMeters: number;
  endMeters: number;
  dpPosition: LatLng;
  snappedDpPoint: LatLng;
  distanceMeters: number;
}): RouteOverlay {
  const { cableLine, startMeters, endMeters, dpPosition, snappedDpPoint, distanceMeters } = params;
  const sliced = turf.lineSliceAlong(cableLine, startMeters, endMeters, { units: "meters" }) as Feature<LineString>;
  const geometry =
    dpPosition.lat === snappedDpPoint.lat && dpPosition.lng === snappedDpPoint.lng
      ? sliced.geometry
      : {
          type: "LineString" as const,
          coordinates: combineLineCoordinates(sliced.geometry.coordinates, [
            toGeoJsonPosition(snappedDpPoint),
            toGeoJsonPosition(dpPosition),
          ]),
        };

  return makeRouteOverlay(geometry, distanceMeters);
}

async function evaluateCandidate(params: {
  dp: DPMarker;
  straightDistanceMeters: number;
  user: LatLng;
  railways: RailwayFeatureCollection | null;
  railwayBufferMeters: number;
  sharedRoadToCable: RouteOverlay | null;
  sharedCableLine: Feature<LineString> | null;
  sharedCableLocationMeters: number | null;
  isNearCable: boolean;
  dpSnapToCableMaxMeters: number;
  warnings: string[];
}): Promise<CandidateResult> {
  const {
    dp,
    straightDistanceMeters,
    user,
    railways,
    railwayBufferMeters,
    sharedRoadToCable,
    sharedCableLine,
    sharedCableLocationMeters,
    isNearCable,
    dpSnapToCableMaxMeters,
    warnings,
  } = params;

  let mode: CandidateResult["mode"] = "DIRECT_ROAD";
  let roadRoute: RouteOverlay | null = null;
  let cableRoute: RouteOverlay | null = null;
  let roadDistanceMeters = Number.POSITIVE_INFINITY;
  let cableDistanceMeters = 0;

  const canUseCable =
    isNearCable &&
    sharedRoadToCable &&
    sharedCableLine &&
    typeof sharedCableLocationMeters === "number" &&
    Number.isFinite(sharedCableLocationMeters);

  if (canUseCable) {
    const snappedDp = turf.nearestPointOnLine(sharedCableLine, toTurfPoint(dp.position), { units: "meters" });
    const dpOffLine =
      typeof snappedDp.properties?.dist === "number" ? snappedDp.properties.dist : Number.POSITIVE_INFINITY;
    const dpLocation = typeof snappedDp.properties?.location === "number" ? snappedDp.properties.location : NaN;

    if (Number.isFinite(dpOffLine) && Number.isFinite(dpLocation) && dpOffLine <= dpSnapToCableMaxMeters) {
      const [snappedLng, snappedLat] = snappedDp.geometry.coordinates;
      const snappedDpPoint: LatLng = { lat: snappedLat, lng: snappedLng };
      const cableAlongMeters = Math.abs(dpLocation - sharedCableLocationMeters);

      mode = "ROAD_TO_CABLE";
      roadRoute = sharedRoadToCable;
      roadDistanceMeters = sharedRoadToCable.distanceMeters;
      cableDistanceMeters = cableAlongMeters + dpOffLine;
      cableRoute = buildCableRouteOverlay({
        cableLine: sharedCableLine,
        startMeters: Math.min(dpLocation, sharedCableLocationMeters),
        endMeters: Math.max(dpLocation, sharedCableLocationMeters),
        dpPosition: dp.position,
        snappedDpPoint,
        distanceMeters: cableDistanceMeters,
      });
    }
  }

  if (mode === "DIRECT_ROAD") {
    try {
      roadRoute = await fetchRoadRoute(user, dp.position);
      roadDistanceMeters = roadRoute.distanceMeters;
    } catch (error) {
      warnings.push(
        error instanceof Error ? `OSRM user->DP gagal (${dp.name}): ${error.message}` : `OSRM user->DP gagal (${dp.name}).`
      );
    }
  }

  const totalDistanceMeters = roadDistanceMeters + cableDistanceMeters;
  const rejectedByRailway =
    !!railways &&
    railways.features.length > 0 &&
    !!roadRoute &&
    routeIntersectsRailwayBuffer({
      routeLine: makeLineFeature(roadRoute.geometry),
      railways,
      bufferMeters: railwayBufferMeters,
    });

  return {
    dp,
    mode,
    straightDistanceMeters,
    roadDistanceMeters,
    cableDistanceMeters,
    totalDistanceMeters,
    rejectedByRailway,
    roadRoute,
    cableRoute,
  };
}

export async function optimizeDropPoints(params: {
  user: LatLng;
  markers: DPMarker[];
  polylines: CablePolyline[];
  options?: {
    candidateLimit?: number;
    cableSnapThresholdMeters?: number;
    railwayRadiusMeters?: number;
    railwayBufferMeters?: number;
    dpSnapToCableMaxMeters?: number;
  };
}): Promise<OptimizationResult> {
  const { user, markers, polylines } = params;
  const warnings: string[] = [];

  const candidateLimit = params.options?.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
  const cableSnapThresholdMeters = params.options?.cableSnapThresholdMeters ?? CABLE_SNAP_THRESHOLD_METERS;
  const railwayRadiusMeters = params.options?.railwayRadiusMeters ?? DEFAULT_RAILWAY_RADIUS_METERS;
  const railwayBufferMeters = params.options?.railwayBufferMeters ?? DEFAULT_RAILWAY_BUFFER_METERS;
  const dpSnapToCableMaxMeters = params.options?.dpSnapToCableMaxMeters ?? DP_SNAP_TO_CABLE_MAX_METERS;

  const nearestByStraight = markers
    .map((dp) => ({ dp, dist: distanceMeters(user, dp.position) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.max(1, candidateLimit));

  const nearestCable = nearestPointOnLine(user, polylines);
  const isNearCable = !!nearestCable && nearestCable.distanceMeters <= cableSnapThresholdMeters;

  const cableSnap: OptimizationResult["cableSnap"] = isNearCable && nearestCable
    ? {
        isNearCable: true,
        distanceMeters: nearestCable.distanceMeters,
        point: nearestCable.nearestPoint,
        polylineId: nearestCable.polyline.id,
        polylineName: nearestCable.polyline.name,
      }
    : { isNearCable: false };

  const cableLine = isNearCable && nearestCable ? toTurfLineString(nearestCable.polyline.coordinates) : null;
  const cableLocationMeters = isNearCable && nearestCable ? nearestCable.locationAlongLineMeters : null;

  const railwaysPromise = fetchRailways(user, railwayRadiusMeters).catch((error) => {
    warnings.push(error instanceof Error ? `Overpass: ${error.message}` : "Overpass: gagal memuat data rel.");
    return null;
  });

  const roadToCablePromise =
    isNearCable && nearestCable
      ? fetchRoadRoute(user, nearestCable.nearestPoint).catch((error) => {
          warnings.push(
            error instanceof Error
              ? `OSRM user->kabel gagal, fallback direct road: ${error.message}`
              : "OSRM user->kabel gagal, fallback direct road."
          );
          return null;
        })
      : Promise.resolve(null);

  const [railways, sharedRoadToCable] = await Promise.all([railwaysPromise, roadToCablePromise]);

  const candidates = await Promise.all(
    nearestByStraight.map(({ dp, dist }) =>
      evaluateCandidate({
        dp,
        straightDistanceMeters: dist,
        user,
        railways,
        railwayBufferMeters,
        sharedRoadToCable,
        sharedCableLine: cableLine,
        sharedCableLocationMeters: cableLocationMeters,
        isNearCable,
        dpSnapToCableMaxMeters,
        warnings,
      })
    )
  );

  const rankedCandidates = [...candidates].sort(sortCandidates);
  const best =
    rankedCandidates.find((candidate) => Number.isFinite(candidate.totalDistanceMeters) && !candidate.rejectedByRailway) ??
    null;

  if (!best && rankedCandidates.length > 0 && railways && railways.features.length > 0) {
    warnings.push("Semua kandidat direject karena memotong buffer rel. Coba geser lokasi user atau evaluasi radius rel.");
  }

  return {
    user,
    cableSnap,
    railways,
    candidates: rankedCandidates,
    best,
    warnings,
  };
}
