import { NextRequest, NextResponse } from "next/server";
import { TranslationsPayloadSchema, dryRunTranslate, runTranslate } from "../../../admin/translations/actions";
import { requireRole } from "@/lib/auth-admin";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "moderator"]);
  if (!auth.authorized) {
    const unauthorized = auth as { authorized: false; error: string; status: number };
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }
  try {
    const body = await req.json();
    const { mode, payload } = body || {};
    const parsed = TranslationsPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }
    if (mode === "dry-run") {
      const res = await dryRunTranslate(parsed.data);
      return NextResponse.json(res);
    }
    if (mode === "run") {
      const res = await runTranslate(parsed.data);
      return NextResponse.json(res);
    }
    return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
