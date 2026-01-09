import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/admin/forum/moderate
 * Moderuj wątki i posty forum (approve/reject/pin/lock/delete)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Sprawdź role admina lub moderatora
    if (!decodedToken.admin && !decodedToken.moderator) {
      return NextResponse.json({ error: "Forbidden - admin or moderator role required" }, { status: 403 });
    }

    const body = await req.json();
    const { action, targetType, targetId, reason, value } = body;

    // Walidacja
    if (!action || !targetType || !targetId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["thread", "post"].includes(targetType)) {
      return NextResponse.json({ error: "Invalid targetType" }, { status: 400 });
    }

    const validActions = ["approve", "reject", "delete", "pin", "unpin", "lock", "unlock", "spam"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Zbuduj update data
    const timestamp = new Date().toISOString();
    let updateData: Record<string, any> = {
      updatedAt: timestamp,
    };

    switch (action) {
      case "approve":
        updateData.status = "approved";
        break;
      case "reject":
        updateData.status = "rejected";
        break;
      case "spam":
        updateData.status = "spam";
        break;
      case "delete":
        updateData.status = "deleted";
        updateData.deletedBy = decodedToken.uid;
        updateData.deletedAt = timestamp;
        if (reason) updateData.deletedReason = reason;
        break;
      case "pin":
        if (targetType === "thread") {
          updateData.isPinned = true;
        }
        break;
      case "unpin":
        if (targetType === "thread") {
          updateData.isPinned = false;
        }
        break;
      case "lock":
        if (targetType === "thread") {
          updateData.isLocked = true;
          updateData.lockedBy = decodedToken.uid;
          updateData.lockedAt = timestamp;
          if (reason) updateData.lockedReason = reason;
        }
        break;
      case "unlock":
        if (targetType === "thread") {
          updateData.isLocked = false;
          updateData.lockedBy = null;
          updateData.lockedAt = null;
          updateData.lockedReason = null;
        }
        break;
    }

    // Zastosuj update w Firestore
    const collection = targetType === "thread" ? "forum_threads" : "forum_posts";
    const docRef = adminDb.collection(collection).doc(targetId);
    
    await docRef.update(updateData);

    // Log moderacji (opcjonalnie)
    await adminDb.collection("moderation_log").add({
      action,
      targetType,
      targetId,
      moderatorUid: decodedToken.uid,
      moderatorEmail: decodedToken.email || null,
      reason: reason || null,
      timestamp,
    });

    return NextResponse.json({ 
      success: true, 
      message: `Action ${action} performed on ${targetType} ${targetId}`,
      updateData 
    });

  } catch (error: any) {
    console.error("Forum moderation error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
