import { NextResponse } from "next/server";

import type { LatLng } from "@/lib/map-types";
import { parseLatLngFromGoogleMapsUrl, resolveGoogleMapsShortUrl } from "@/lib/parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ ok: false, error: "url wajib." }, { status: 400 });

    const direct = parseLatLngFromGoogleMapsUrl(url);
    if (direct) {
      const latLng: LatLng = direct;
      return NextResponse.json({ ok: true, latLng });
    }

    const resolved = await resolveGoogleMapsShortUrl(url);
    const parsed = parseLatLngFromGoogleMapsUrl(resolved);
    if (!parsed) return NextResponse.json({ ok: false, error: "Koordinat tidak ditemukan pada URL." }, { status: 400 });

    const latLng: LatLng = parsed;
    return NextResponse.json({ ok: true, latLng, resolvedUrl: resolved });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Resolve gagal." },
      { status: 500 }
    );
  }
}
