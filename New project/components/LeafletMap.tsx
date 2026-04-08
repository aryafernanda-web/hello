"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { DEFAULT_ZOOM, MAP_ATTRIBUTION, MAP_TILE_URL } from "@/lib/constants";
import { toLeafletLatLngs } from "@/lib/geo";
import type { CablePolyline, DPMarker, LatLng } from "@/lib/map-types";
import type { RouteOverlay } from "@/lib/optimizer";
import type { RailwayFeatureCollection } from "@/lib/railway";

import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const BASE_CABLE_STYLE = { color: "#38bdf8", weight: 4, opacity: 0.78 };
const RAILWAY_STYLE = { color: "#f8fafc", weight: 3, opacity: 0.75, dashArray: "6 8" };
const ACTIVE_CABLE_STYLE = { color: "#22c55e", weight: 6, opacity: 0.95 };
const ROAD_STYLE = { color: "#f97316", weight: 5, opacity: 0.95, dashArray: "10 8" };
const CABLE_SNAP_STYLE = { color: "#22c55e", fillColor: "#08111f", fillOpacity: 1, weight: 3 };
const USER_STYLE = { color: "#f8fafc", fillColor: "#0f172a", fillOpacity: 1, weight: 3 };

function MapClick({ onPick }: { onPick: (latLng: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function MapViewport(props: {
  fallbackCenter: LatLng;
  userLocation: LatLng | null;
  selectedDp: DPMarker | null;
  roadRoute: RouteOverlay | null;
  cableRoute: RouteOverlay | null;
  cableSnapPoint: LatLng | null;
}) {
  const map = useMap();
  const { fallbackCenter, userLocation, selectedDp, roadRoute, cableRoute, cableSnapPoint } = props;

  useEffect(() => {
    const points: Array<[number, number]> = [[fallbackCenter.lat, fallbackCenter.lng]];

    const extendLine = (coordinates: ReadonlyArray<number[]> | undefined) => {
      for (const [lng, lat] of coordinates ?? []) {
        points.push([lat, lng]);
      }
    };

    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
    if (selectedDp) points.push([selectedDp.position.lat, selectedDp.position.lng]);
    if (cableSnapPoint) points.push([cableSnapPoint.lat, cableSnapPoint.lng]);

    extendLine(roadRoute?.geometry.coordinates);
    extendLine(cableRoute?.geometry.coordinates);

    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 });
      return;
    }

    map.setView([fallbackCenter.lat, fallbackCenter.lng], DEFAULT_ZOOM);
  }, [cableRoute, cableSnapPoint, fallbackCenter, map, roadRoute, selectedDp, userLocation]);

  return null;
}

export default function LeafletMap(props: {
  center: LatLng;
  userLocation: LatLng | null;
  onUserLocationChange: (latLng: LatLng) => void;
  markers: DPMarker[];
  polylines: CablePolyline[];
  selectedDpId: string | null;
  bestDpId: string | null;
  roadRoute: RouteOverlay | null;
  cableRoute: RouteOverlay | null;
  cableSnapPoint: LatLng | null;
  railways: RailwayFeatureCollection | null;
}) {
  const { center, userLocation, onUserLocationChange, markers, polylines, selectedDpId, bestDpId, roadRoute, cableRoute } =
    props;

  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: iconRetinaUrl.src ?? (iconRetinaUrl as unknown as string),
      iconUrl: iconUrl.src ?? (iconUrl as unknown as string),
      shadowUrl: shadowUrl.src ?? (shadowUrl as unknown as string),
    });
  }, []);

  const selectedDp = useMemo(
    () => markers.find((marker) => marker.id === selectedDpId) ?? null,
    [markers, selectedDpId]
  );

  const cableLatLngs = useMemo(() => polylines.map((polyline) => toLeafletLatLngs(polyline.coordinates)), [polylines]);
  const roadLatLngs = useMemo(
    () => (roadRoute ? toLeafletLatLngs(roadRoute.geometry.coordinates) : null),
    [roadRoute]
  );
  const cableRouteLatLngs = useMemo(
    () => (cableRoute ? toLeafletLatLngs(cableRoute.geometry.coordinates) : null),
    [cableRoute]
  );
  const railwayLatLngs = useMemo(
    () => props.railways?.features.map((feature) => toLeafletLatLngs(feature.geometry.coordinates)) ?? [],
    [props.railways]
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />
      <ZoomControl position="bottomright" />

      <MapViewport
        fallbackCenter={center}
        userLocation={userLocation}
        selectedDp={selectedDp}
        roadRoute={roadRoute}
        cableRoute={cableRoute}
        cableSnapPoint={props.cableSnapPoint}
      />

      <MapClick onPick={onUserLocationChange} />

      {cableLatLngs.map((latLngs, index) => (
        <Polyline key={polylines[index]?.id ?? index} positions={latLngs} pathOptions={BASE_CABLE_STYLE} />
      ))}

      {railwayLatLngs.map((latLngs, index) => (
        <Polyline key={`rail-${index}`} positions={latLngs} pathOptions={RAILWAY_STYLE} />
      ))}

      {cableRouteLatLngs && <Polyline positions={cableRouteLatLngs} pathOptions={ACTIVE_CABLE_STYLE} />}

      {roadLatLngs && <Polyline positions={roadLatLngs} pathOptions={ROAD_STYLE} />}

      {props.cableSnapPoint && (
        <CircleMarker center={[props.cableSnapPoint.lat, props.cableSnapPoint.lng]} radius={7} pathOptions={CABLE_SNAP_STYLE}>
          <Popup>Titik snap ke jalur kabel</Popup>
        </CircleMarker>
      )}

      {userLocation && (
        <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={8} pathOptions={USER_STYLE}>
          <Popup>Lokasi user</Popup>
        </CircleMarker>
      )}

      {markers.map((marker) => {
        const isSelected = marker.id === selectedDpId;
        const isBest = marker.id === bestDpId;

        return (
          <Marker key={marker.id} position={[marker.position.lat, marker.position.lng]} opacity={isSelected ? 1 : 0.9}>
            <Popup>
              <div className="text-sm font-semibold">{marker.name}</div>
              <div className="mt-1 font-mono text-xs">
                {marker.position.lat.toFixed(6)}, {marker.position.lng.toFixed(6)}
              </div>
            </Popup>
            {(isSelected || isBest) && (
              <Tooltip permanent direction="top" offset={[0, -18]} className="candidate-label">
                {isSelected ? "DP dipilih" : "DP terbaik"}
              </Tooltip>
            )}
          </Marker>
        );
      })}

      {markers.map((marker) => {
        const isSelected = marker.id === selectedDpId;
        const isBest = marker.id === bestDpId;
        if (!isSelected && !isBest) return null;

        return (
          <CircleMarker
            key={`${marker.id}-highlight`}
            center={[marker.position.lat, marker.position.lng]}
            radius={isSelected ? 13 : 11}
            pathOptions={{
              color: isSelected ? "#eab308" : "#22c55e",
              fillColor: isSelected ? "#eab308" : "#22c55e",
              fillOpacity: 0.18,
              weight: 2,
            }}
          />
        );
      })}
    </MapContainer>
  );
}
