import { NextResponse } from "next/server";

import type { LatLng } from "@/lib/map-types";
import type { OsrmProfile } from "@/lib/osrm";
import { fetchOsrmRoute } from "@/lib/osrm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROFILES: OsrmProfile[] = ["driving", "walking", "cycling"];

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
    const body = (await req.json()) as { from?: unknown; to?: unknown; profile?: unknown };
    if (!isLatLng(body.from) || !isLatLng(body.to)) {
      return NextResponse.json({ ok: false, error: "Body harus { from:{lat,lng}, to:{lat,lng} }." }, { status: 400 });
    }

    const profile =
      typeof body.profile === "string" && VALID_PROFILES.includes(body.profile as OsrmProfile)
        ? (body.profile as OsrmProfile)
        : "driving";
    const route = await fetchOsrmRoute({ from: body.from, to: body.to, profile });

    return NextResponse.json({ ok: true, route });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Routing gagal." },
      { status: 500 }
    );
  }
}
