import { NextRequest, NextResponse } from "next/server";
import { TranslationsPayloadSchema, dryRunTranslate, runTranslate } from "@/app/admin/translations/actions";

export async function POST(req: NextRequest) {
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
