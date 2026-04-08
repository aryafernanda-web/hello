import type { LatLng } from "@/lib/map-types";

export const DEFAULT_CENTER: LatLng = { lat: -8.0652, lng: 111.9022 };
export const DEFAULT_ZOOM = 16;
export const COVER_THRESHOLD_METERS = 350;
export const CABLE_SNAP_THRESHOLD_METERS = 30;
export const DP_SNAP_TO_CABLE_MAX_METERS = 80;
export const DEFAULT_CANDIDATE_LIMIT = 6;
export const DEFAULT_RAILWAY_RADIUS_METERS = 1200;
export const DEFAULT_RAILWAY_BUFFER_METERS = 10;
export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
