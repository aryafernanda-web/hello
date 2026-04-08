"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CABLE_SNAP_THRESHOLD_METERS,
  COVER_THRESHOLD_METERS,
  DEFAULT_CANDIDATE_LIMIT,
  DEFAULT_CENTER,
  DEFAULT_RAILWAY_BUFFER_METERS,
  DEFAULT_RAILWAY_RADIUS_METERS,
} from "@/lib/constants";
import { mapData } from "@/lib/map-data";
import type { DPMarker, LatLng } from "@/lib/map-types";
import type { CandidateResult, OptimizationResult } from "@/lib/optimizer";
import { optimizeDropPoints } from "@/lib/optimizer";
import { parseLatLngFromGoogleMapsUrl } from "@/lib/parser";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-900/60" />,
});

function formatMeters(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return `${Math.round(value)} m`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "N/A";
  if (seconds < 60) return `${Math.round(seconds)} dtk`;
  return `${Math.round(seconds / 60)} mnt`;
}

function getStatusLabel(candidate: CandidateResult | null): "COVER" | "NOT_COVER" | null {
  if (!candidate || !Number.isFinite(candidate.totalDistanceMeters)) return null;
  return candidate.totalDistanceMeters <= COVER_THRESHOLD_METERS ? "COVER" : "NOT_COVER";
}

export default function MapApp({ embed }: { embed: boolean }) {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [selectedDpId, setSelectedDpId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const optimizationRequestRef = useRef(0);

  const markers = mapData.markers;
  const polylines = mapData.polylines;
  const areaName = mapData.meta?.areaName ?? "Botoran, Tulungagung";
  const defaultCenter = mapData.meta?.defaultCenter ?? DEFAULT_CENTER;

  const selectedDp: DPMarker | null = useMemo(
    () => markers.find((marker) => marker.id === selectedDpId) ?? null,
    [markers, selectedDpId]
  );

  const selectedCandidate: CandidateResult | null = useMemo(() => {
    if (!optimization || !selectedDpId) return null;
    return optimization.candidates.find((candidate) => candidate.dp.id === selectedDpId) ?? null;
  }, [optimization, selectedDpId]);

  const bestCandidate = optimization?.best ?? null;
  const statusLabel = getStatusLabel(selectedCandidate);
  const cableSnap = optimization && optimization.cableSnap.isNearCable ? optimization.cableSnap : null;

  const handleUseMyLocation = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation tidak tersedia di browser ini.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (geoError) => {
        setIsLocating(false);
        setError(geoError.message || "Gagal mengambil lokasi user.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  const handleSetFromGoogleMaps = useCallback(async () => {
    setError(null);
    const rawUrl = googleMapsUrl.trim();
    if (!rawUrl) return;

    const parsed = parseLatLngFromGoogleMapsUrl(rawUrl);
    if (parsed) {
      setUserLocation(parsed);
      return;
    }

    try {
      const response = await fetch("/api/resolve-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
      });
      const json = (await response.json()) as { ok: boolean; latLng?: LatLng; error?: string };
      if (!json.ok || !json.latLng) throw new Error(json.error || "Gagal membaca URL Google Maps.");
      setUserLocation(json.latLng);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal resolve URL Google Maps.");
    }
  }, [googleMapsUrl]);

  const runOptimization = useCallback(
    async (location: LatLng) => {
      const requestId = optimizationRequestRef.current + 1;
      optimizationRequestRef.current = requestId;
      setIsOptimizing(true);
      setError(null);

      try {
        const result = await optimizeDropPoints({
          user: location,
          markers,
          polylines,
          options: {
            candidateLimit: DEFAULT_CANDIDATE_LIMIT,
            cableSnapThresholdMeters: CABLE_SNAP_THRESHOLD_METERS,
            railwayRadiusMeters: DEFAULT_RAILWAY_RADIUS_METERS,
            railwayBufferMeters: DEFAULT_RAILWAY_BUFFER_METERS,
          },
        });

        if (optimizationRequestRef.current !== requestId) return;
        setOptimization(result);
        setSelectedDpId(result.best?.dp.id ?? result.candidates[0]?.dp.id ?? null);
      } catch (optimizationError) {
        if (optimizationRequestRef.current !== requestId) return;
        setOptimization(null);
        setSelectedDpId(null);
        setError(optimizationError instanceof Error ? optimizationError.message : "Optimasi gagal dijalankan.");
      } finally {
        if (optimizationRequestRef.current === requestId) {
          setIsOptimizing(false);
        }
      }
    },
    [markers, polylines]
  );

  useEffect(() => {
    if (!userLocation) return;
    void runOptimization(userLocation);
  }, [runOptimization, userLocation]);

  const mapHeightClass = embed
    ? "absolute inset-0 h-full rounded-none border-0"
    : "h-[calc(100vh-96px)] rounded-[30px] border border-white/10 md:h-[calc(100vh-120px)]";

  return (
    <div className={embed ? "relative h-screen overflow-hidden" : "min-h-screen"}>
      {!embed && (
        <header className="relative z-10 px-4 pb-3 pt-4 md:px-6">
          <div className="glass-panel mx-auto flex max-w-7xl flex-col gap-3 rounded-[28px] px-5 py-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                WebGIS Fiber Routing
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Analisis jalur FO dan pemilihan DP optimal untuk area {areaName}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Tempel URL Google Maps, pakai geolocation, atau klik langsung peta untuk menjalankan hybrid routing
                user - jalan - kabel - DP dengan validasi buffer rel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 md:min-w-[320px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Area Default</div>
                <div className="mt-1 font-medium text-slate-100">{areaName}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Mode Embed</div>
                <div className="mt-1 font-medium text-slate-100">Tambahkan `?embed=true`</div>
              </div>
            </div>
          </div>
        </header>
      )}

      <section className={embed ? "relative h-full" : "mx-auto max-w-7xl px-4 pb-4 md:px-6"}>
        <div className={`relative overflow-hidden ${mapHeightClass}`}>
          <div className="absolute inset-0">
            <LeafletMap
              center={defaultCenter}
              userLocation={userLocation}
              onUserLocationChange={setUserLocation}
              markers={markers}
              polylines={polylines}
              selectedDpId={selectedDpId}
              bestDpId={bestCandidate?.dp.id ?? null}
              roadRoute={selectedCandidate?.roadRoute ?? null}
              cableRoute={selectedCandidate?.cableRoute ?? null}
              cableSnapPoint={cableSnap?.point ?? null}
              railways={optimization?.railways ?? null}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-between gap-3 p-3">
            <div className="glass-panel pointer-events-auto max-h-[min(62vh,720px)] w-[calc(100vw-24px)] max-w-[420px] overflow-auto rounded-[26px] p-4 text-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                  Panel Info
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-300">
                  SLA tarik: sampai {COVER_THRESHOLD_METERS} m
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Lokasi User</div>
                      <div className="mt-1 font-mono text-[13px] text-slate-100">
                        {userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}` : "Belum dipilih"}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">Klik peta untuk set manual</div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-emerald-500 px-3 py-2 text-[12px] font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleUseMyLocation}
                      disabled={isLocating}
                    >
                      {isLocating ? "Mengambil lokasi..." : "Gunakan lokasi saya"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-white/15"
                      onClick={() => setUserLocation(defaultCenter)}
                    >
                      Reset ke Botoran
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Input Google Maps</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      aria-label="URL Google Maps"
                      value={googleMapsUrl}
                      onChange={(event) => setGoogleMapsUrl(event.target.value)}
                      placeholder="Paste URL Google Maps atau shortlink..."
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-[13px] text-slate-100 outline-none ring-0 placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      className="rounded-2xl bg-sky-500 px-4 py-2 text-[12px] font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleSetFromGoogleMaps}
                      disabled={!googleMapsUrl.trim()}
                    >
                      Set
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-slate-400">
                    Mendukung format `?q=lat,lng`, `@lat,lng`, `/@lat,lng`, dan shortlink yang di-resolve via server.
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">DP Terpilih</div>
                      <div className="mt-1 text-lg font-semibold text-white">{selectedDp?.name ?? "Belum ada hasil"}</div>
                      <div className="mt-1 font-mono text-[12px] text-slate-400">
                        {selectedDp
                          ? `${selectedDp.position.lat.toFixed(6)}, ${selectedDp.position.lng.toFixed(6)}`
                          : "Koordinat DP belum tersedia"}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      {isOptimizing ? "Optimasi berjalan..." : `${optimization?.candidates.length ?? 0} kandidat`}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-[13px] text-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Mode rute</span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-slate-100">
                        {selectedCandidate?.mode === "ROAD_TO_CABLE" ? "ROAD TO CABLE" : selectedCandidate ? "DIRECT ROAD" : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Jarak lurus</span>
                      <span className="font-mono">{formatMeters(selectedCandidate?.straightDistanceMeters ?? Number.NaN)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Jarak jalan</span>
                      <span className="font-mono">{formatMeters(selectedCandidate?.roadDistanceMeters ?? Number.NaN)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Jarak kabel</span>
                      <span className="font-mono">{formatMeters(selectedCandidate?.cableDistanceMeters ?? Number.NaN)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Estimasi perjalanan</span>
                      <span className="font-mono">{formatDuration(selectedCandidate?.roadRoute?.durationSeconds)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
                      <span className="text-slate-300">Total jarak</span>
                      <span className="font-mono text-[15px] font-semibold">
                        {formatMeters(selectedCandidate?.totalDistanceMeters ?? Number.NaN)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-300">Status cover</span>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          statusLabel === "COVER"
                            ? "bg-emerald-500 text-slate-950"
                            : statusLabel === "NOT_COVER"
                            ? "bg-rose-500 text-white"
                            : "bg-white/10 text-slate-200"
                        }`}
                      >
                        {statusLabel === "COVER" ? "Cover" : statusLabel === "NOT_COVER" ? "Not Cover" : "Belum ada"}
                      </span>
                    </div>
                    {selectedCandidate?.rejectedByRailway && (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-100">
                        Kandidat ini direject karena rute jalannya memotong buffer rel {DEFAULT_RAILWAY_BUFFER_METERS} m.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="glass-panel pointer-events-auto w-[320px] rounded-[26px] p-4 text-sm text-slate-200">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ringkasan Analisis</div>
                <div className="mt-3 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Cable Snap</div>
                    {cableSnap ? (
                      <>
                        <div className="mt-1 font-semibold text-emerald-200">{cableSnap.polylineName}</div>
                        <div className="mt-1 text-[12px] text-slate-300">
                          User dekat kabel dalam radius {Math.round(cableSnap.distanceMeters)} m.
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-[12px] text-slate-300">
                        Tidak ada kabel terdekat di bawah threshold {CABLE_SNAP_THRESHOLD_METERS} m.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Validasi Rel</div>
                    <div className="mt-1 text-[12px] text-slate-300">
                      Terdeteksi {optimization?.railways?.features.length ?? 0} geometri rel dalam radius{" "}
                      {DEFAULT_RAILWAY_RADIUS_METERS} m.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">DP Terbaik Saat Ini</div>
                    <div className="mt-1 font-semibold text-white">{bestCandidate?.dp.name ?? "Belum ada hasil valid"}</div>
                    <div className="mt-1 text-[12px] text-slate-300">
                      {bestCandidate ? `${formatMeters(bestCandidate.totalDistanceMeters)} total tarikan` : "Set lokasi user untuk memulai kalkulasi."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3 md:p-4">
            <div className="glass-panel pointer-events-auto mx-auto max-h-[40vh] max-w-5xl overflow-auto rounded-[26px] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Kandidat DP Terdekat</div>
                  <p className="mt-1 text-sm text-slate-300">
                    Pilih manual salah satu kandidat untuk membandingkan breakdown jarak dan status cover.
                  </p>
                </div>
                <div className="text-[12px] text-slate-400">
                  Jalan raya ditampilkan oranye putus-putus, kabel fiber hijau dan backbone kabel biru.
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {optimization?.candidates.map((candidate) => {
                  const candidateStatus = getStatusLabel(candidate);
                  const isSelected = candidate.dp.id === selectedDpId;

                  return (
                    <button
                      key={candidate.dp.id}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`Pilih ${candidate.dp.name}`}
                      onClick={() => setSelectedDpId(candidate.dp.id)}
                      className={`rounded-[22px] border p-3 text-left transition ${
                        isSelected
                          ? "border-sky-300/60 bg-sky-300/12"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{candidate.dp.name}</div>
                          <div className="mt-1 text-[12px] text-slate-400">
                            {candidate.mode === "ROAD_TO_CABLE" ? "User -> jalan -> kabel -> DP" : "User -> jalan -> DP"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[13px] text-slate-100">{formatMeters(candidate.totalDistanceMeters)}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{candidate.rejectedByRailway ? "Rejected" : "Valid"}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">
                          lurus {formatMeters(candidate.straightDistanceMeters)}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">
                          jalan {formatMeters(candidate.roadDistanceMeters)}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">
                          kabel {formatMeters(candidate.cableDistanceMeters)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 font-semibold ${
                            candidateStatus === "COVER"
                              ? "bg-emerald-500 text-slate-950"
                              : candidateStatus === "NOT_COVER"
                              ? "bg-rose-500 text-white"
                              : "bg-white/10 text-slate-200"
                          }`}
                        >
                          {candidateStatus === "COVER" ? "Cover" : candidateStatus === "NOT_COVER" ? "Not Cover" : "Pending"}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {!optimization && (
                  <div className="rounded-[22px] border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-400">
                    Hasil kandidat akan muncul setelah lokasi user tersedia.
                  </div>
                )}
              </div>

              {(error || optimization?.warnings.length) && (
                <div className="mt-4 rounded-[22px] border border-white/10 bg-slate-950/55 p-3 text-sm text-slate-200">
                  {error && <div className="text-rose-300">Error: {error}</div>}
                  {!!optimization?.warnings.length && (
                    <div className="mt-2 grid gap-1 text-[12px] text-slate-300">
                      {optimization.warnings.map((warning) => (
                        <div key={warning}>- {warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
