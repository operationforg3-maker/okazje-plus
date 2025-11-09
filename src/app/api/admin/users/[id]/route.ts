import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { role, disabled } = await request.json();
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Brak ID użytkownika" },
        { status: 400 }
      );
    }

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { success: false, message: "Użytkownik nie istnieje" },
        { status: 404 }
      );
    }

    const updateData: any = {};
    
    if (role !== undefined) {
      if (!["admin", "user"].includes(role)) {
        return NextResponse.json(
          { success: false, message: "Nieprawidłowa rola" },
          { status: 400 }
        );
      }
      updateData.role = role;
    }

    if (disabled !== undefined) {
      updateData.disabled = disabled;
    }

    await updateDoc(userRef, updateData);

    return NextResponse.json(
      {
        success: true,
        message: "Użytkownik został zaktualizowany",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Błąd podczas aktualizacji użytkownika:", error);
    return NextResponse.json(
      { success: false, message: "Wystąpił błąd podczas aktualizacji" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Brak ID użytkownika" },
        { status: 400 }
      );
    }

    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return NextResponse.json(
        { success: false, message: "Użytkownik nie istnieje" },
        { status: 404 }
      );
    }

    // Zamiast usuwać, oznaczamy jako disabled
    await updateDoc(userRef, {
      disabled: true,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Użytkownik został zablokowany",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Błąd podczas blokowania użytkownika:", error);
    return NextResponse.json(
      { success: false, message: "Wystąpił błąd podczas blokowania" },
      { status: 500 }
    );
  }
}
