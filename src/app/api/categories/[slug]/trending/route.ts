import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getHotDealsByCategory, getTopProductsByCategory } from "@/lib/data";

export const runtime = "nodejs";

// Uproszczony trending: miesza gorące okazje i najwyżej oceniane produkty (fallback).
// Docelowo: źródło z Genkit/AI + dodatkowe sygnały.
export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "6", 10), 1), 24);

    const cacheKey = `cat:${slug}:trending:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, fromCache: true, items: cached }, { status: 200 });
    }

    const [deals, products] = await Promise.all([
      getHotDealsByCategory(slug, Math.ceil(limit / 2)),
      getTopProductsByCategory(slug, Math.floor(limit / 2)),
    ]);

    const items = [
      ...deals.map((d) => ({ type: "deal" as const, ...d })),
      ...products.map((p) => ({ type: "product" as const, ...p })),
    ];

    await cacheSet(cacheKey, items, 60);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
