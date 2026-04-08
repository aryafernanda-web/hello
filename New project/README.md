# Fiber DP Finder

Aplikasi WebGIS berbasis Next.js 14 App Router untuk mencari jalur kabel fiber optic terdekat dan menentukan Drop Point (DP) optimal berdasarkan lokasi user.

## Fitur Utama
- Dynamic Leaflet map yang aman dipakai di App Router dan siap embed ke Notion iframe.
- Parser URL Google Maps untuk format `?q=lat,lng`, `@lat,lng`, `/@lat,lng`, raw `lat,lng`, dan shortlink.
- Hybrid routing:
  - Jika user dekat kabel: `user -> jalan -> kabel -> DP`
  - Jika tidak: `user -> jalan -> DP`
- Proxy server-side untuk OSRM dan Overpass agar browser bebas dari masalah CORS.
- Validasi buffer rel 10 meter untuk reject rute jalan yang memotong jalur rel.
- Status cover berdasarkan SLA tarikan `<= 350 m`.

## Menjalankan Proyek
1. Install dependency:
   - `npm install`
2. Jalankan dev server:
   - `npm run dev`
3. Opsional pemeriksaan statis:
   - `npm run lint`
   - `npm run typecheck`

## Variabel Environment Opsional
- `OSRM_BASE_URL`
  - Default: `https://router.project-osrm.org`
- `OVERPASS_ENDPOINT`
  - Default: `https://overpass-api.de/api/interpreter`
- Contoh file:
  - [.env.example](C:/Users/muhamad_arya/Documents/New%20project/.env.example)

## Mode Embed Notion
- Gunakan parameter `?embed=true`
- Header CSP sudah mengizinkan iframe dari domain Notion:
  - `https://www.notion.so`
  - `https://*.notion.so`
  - `https://www.notion.site`
  - `https://*.notion.site`

## Struktur Data `data/map.json`
```json
{
  "meta": {
    "areaName": "Botoran, Tulungagung",
    "defaultCenter": { "lat": -8.0652, "lng": 111.9022 },
    "source": "Google My Maps -> JSON lokal"
  },
  "markers": [
    {
      "id": "dp-botoran-1",
      "name": "DP Botoran 1",
      "position": { "lat": -8.06465, "lng": 111.90315 }
    }
  ],
  "polylines": [
    {
      "id": "kabel-utama-1",
      "name": "Jalur Kabel Utama",
      "coordinates": [
        { "lat": -8.0663, "lng": 111.901 },
        { "lat": -8.0656, "lng": 111.9017 }
      ]
    }
  ]
}
```

## Checklist Uji Manual
1. Buka halaman utama, pastikan peta ter-load dan fokus awal berada di Botoran.
2. Klik peta, cek koordinat user di panel langsung berubah dan kandidat DP muncul.
3. Tempel URL Google Maps dengan format `?q=lat,lng` lalu tekan `Set`.
4. Coba shortlink Google Maps, pastikan route `/api/resolve-maps` bisa resolve koordinat.
5. Pilih beberapa kandidat DP, pastikan jalur jalan oranye dan jalur kabel hijau ikut berubah.
6. Tambahkan `?embed=true` ke URL, pastikan header/footer hilang dan tidak ada scroll.
