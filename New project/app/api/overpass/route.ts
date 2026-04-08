import { NextResponse } from "next/server";

import type { LatLng } from "@/lib/map-types";
import { fetchRailways } from "@/lib/overpass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.lat === "number" &&
    typeof obj.lng === "number" &&
    Number.isFinite(obj.lat) &&
    Number.isFinite(obj.lng) &&
    Math.abs(obj.lat) <= 90 &&
    Math.abs(obj.lng) <= 180
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { center?: unknown; radiusMeters?: unknown };
    if (!isLatLng(body.center)) {
      return NextResponse.json({ ok: false, error: "Body harus { center:{lat,lng}, radiusMeters }." }, { status: 400 });
    }
    const radiusMeters =
      typeof body.radiusMeters === "number" && Number.isFinite(body.radiusMeters) ? body.radiusMeters : 1200;
    if (radiusMeters <= 0) {
      return NextResponse.json({ ok: false, error: "radiusMeters harus lebih besar dari 0." }, { status: 400 });
    }

    const railways = await fetchRailways({ center: body.center, radiusMeters });
    return NextResponse.json({ ok: true, railways });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Overpass gagal." },
      { status: 500 }
    );
  }
}
