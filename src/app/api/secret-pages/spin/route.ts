import { NextRequest, NextResponse } from "next/server";
import { recordSecretPageSpin } from "@/lib/data";

export async function POST(req: NextRequest) {
  try {
    const { pageId, prizeId, prizeLabel, userId } = await req.json();

    if (!pageId || !prizeId || !prizeLabel) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await recordSecretPageSpin(pageId, prizeId, prizeLabel, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record spin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
