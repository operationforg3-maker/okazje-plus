import { NextRequest, NextResponse } from "next/server";
import { DealsPayloadSchema, dryRunImportDeals, runImportDeals } from "../../../admin/deals-import/actions";
import { requireRole } from "@/lib/auth-admin";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "moderator"]);
  if (!auth.authorized) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  try {
    const body = await req.json();
    const { mode, payload } = body || {};
    const parsed = DealsPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }
    if (mode === "dry-run") {
      const res = await dryRunImportDeals(parsed.data);
      return NextResponse.json(res);
    }
    if (mode === "run") {
      const res = await runImportDeals(parsed.data);
      return NextResponse.json(res);
    }
    return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
