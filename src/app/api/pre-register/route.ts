import { NextRequest, NextResponse } from "next/server";
import { createPreRegistration } from "@/lib/data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email || !name) {
      return NextResponse.json(
        { success: false, error: "Email i imię są wymagane" },
        { status: 400 }
      );
    }

    // Walidacja email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowy adres email" },
        { status: 400 }
      );
    }

    // Walidacja imienia
    if (name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Imię musi mieć minimum 2 znaki" },
        { status: 400 }
      );
    }

    // Pobierz IP i User-Agent
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Utwórz pre-rejestrację
    const result = await createPreRegistration({
      email,
      name,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      registrationNumber: result.registrationNumber,
      message: "Rejestracja przebiegła pomyślnie",
    });
  } catch (error) {
    console.error("Pre-registration error:", error);
    return NextResponse.json(
      { success: false, error: "Wystąpił błąd podczas rejestracji" },
      { status: 500 }
    );
  }
}
