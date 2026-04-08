export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMeta {
  areaName: string;
  defaultCenter: LatLng;
  source?: string;
}

export interface DPMarker {
  id: string;
  name: string;
  position: LatLng;
}

export interface CablePolyline {
  id: string;
  name: string;
  coordinates: LatLng[];
}

export interface MapData {
  meta?: MapMeta;
  markers: DPMarker[];
  polylines: CablePolyline[];
}
