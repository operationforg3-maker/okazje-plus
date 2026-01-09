import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getHotDealsByCategory } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "3", 10), 1), 12);

    const cacheKey = `cat:${slug}:hot-deals:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, fromCache: true, items: cached }, { status: 200 });
    }

    const items = await getHotDealsByCategory(slug, limit);
    await cacheSet(cacheKey, items, 60);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
