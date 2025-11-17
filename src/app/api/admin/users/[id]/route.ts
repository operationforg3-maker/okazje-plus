import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

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

    // Autoryzacja: wymagany Bearer token admina
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Brak nagłówka Authorization' }, { status: 401 });
    }
    const idToken = authHeader.substring('Bearer '.length).trim();
    const { getAuth } = await import('firebase-admin/auth');
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error('[PUT /api/admin/users/:id] Token verify error', e);
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
    }
    const adminDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Brak uprawnień' }, { status: 403 });
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

  if (!userDoc.exists) {
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

  await userRef.update(updateData);

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

    // Autoryzacja: wymagany Bearer token admina
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Brak nagłówka Authorization' }, { status: 401 });
    }
    const idToken = authHeader.substring('Bearer '.length).trim();
    const { getAuth } = await import('firebase-admin/auth');
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error('[DELETE /api/admin/users/:id] Token verify error', e);
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
    }
    const adminDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Brak uprawnień' }, { status: 403 });
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

  if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, message: "Użytkownik nie istnieje" },
        { status: 404 }
      );
    }

    // Zamiast usuwać, oznaczamy jako disabled
    await userRef.update({ disabled: true });

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
