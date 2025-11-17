import { NextResponse } from "next/server";
import { getPreRegistrationCount } from "@/lib/data";

export async function GET() {
  try {
    const count = await getPreRegistrationCount();
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching pre-registration count:", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
