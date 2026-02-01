import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/forum/best-answer
 * Oznacz post jako najlepszą odpowiedź w wątku
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    const body = await req.json();
    const { threadId, postId } = body;

    if (!threadId || !postId) {
      return NextResponse.json({ error: "Missing threadId or postId" }, { status: 400 });
    }

    // Pobierz wątek
    const threadRef = adminDb.collection("forum_threads").doc(threadId);
    const threadSnap = await threadRef.get();

    if (!threadSnap.exists) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const threadData = threadSnap.data();

    // Sprawdź, czy użytkownik jest autorem wątku lub adminem
    if (threadData?.authorUid !== decodedToken.uid && !decodedToken.admin && !decodedToken.moderator) {
      return NextResponse.json({ error: "Only thread author or moderator can mark best answer" }, { status: 403 });
    }

    // Pobierz post z subkolekcji wątku
    const postRef = adminDb.collection("forum_threads").doc(threadId).collection("posts").doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Jeśli już jest oznaczony jako najlepsza odpowiedź, odznacz
    if (threadData?.bestAnswerId === postId) {
      await threadRef.update({
        bestAnswerId: null,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ 
        success: true, 
        message: "Best answer unmarked",
        bestAnswerId: null,
      });
    }

    // Oznacz jako najlepszą odpowiedź
    await threadRef.update({
      bestAnswerId: postId,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      message: "Post marked as best answer",
      bestAnswerId: postId,
    });

  } catch (error: any) {
    console.error("Best answer error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
