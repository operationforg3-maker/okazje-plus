import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-admin";
import { adminDb } from "@/lib/firebase-admin";
import { PromptConfig } from "@/lib/types";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "moderator"]);
  if (!auth.authorized) {
    const unauthorized = auth as { authorized: false; error: string; status: number };
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }
  try {
    const snapshot = await adminDb.collection("admin_configs").where("type", "==", "prompt").get();
    const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PromptConfig[];
    return NextResponse.json({ ok: true, prompts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load prompts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "moderator"]);
  if (!auth.authorized) {
    const unauthorized = auth as { authorized: false; error: string; status: number };
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }
  try {
    const body = await req.json();
    const { id, target, name, prompt } = body;
    const now = new Date().toISOString();
    const data: Partial<PromptConfig> = {
      target,
      name,
      prompt,
      updatedAt: now,
    };
    if (id) {
      await adminDb.collection("admin_configs").doc(id).update(data);
      return NextResponse.json({ ok: true, id });
    } else {
      const ref = await adminDb.collection("admin_configs").add({ ...data, type: "prompt", createdAt: now });
      return NextResponse.json({ ok: true, id: ref.id });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to save prompt" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "moderator"]);
  if (!auth.authorized) {
    const unauthorized = auth as { authorized: false; error: string; status: number };
    return NextResponse.json({ ok: false, error: unauthorized.error }, { status: unauthorized.status });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await adminDb.collection("admin_configs").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to delete prompt" }, { status: 500 });
  }
}
