import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/admin/forum/moderate
 * Lists forum threads and posts requiring moderation.
 * Query: filter=pending|reported|all, limit=30
 * Uses Admin SDK — no client Firestore needed.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken.admin && !decodedToken.moderator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "pending";
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "30", 10));

    const toISO = (val: unknown): string => {
      if (!val) return "";
      if (typeof val === "string") return val;
      if (typeof (val as Record<string, unknown>)._seconds === "number")
        return new Date((val as { _seconds: number })._seconds * 1000).toISOString();
      if (typeof (val as { toDate?: () => Date }).toDate === "function")
        return (val as { toDate: () => Date }).toDate().toISOString();
      return String(val);
    };

    // ── Threads ──────────────────────────────────────────────────────────────
    const threadsRef = adminDb.collection("forum_threads");
    let threadsSnap;

    if (filter === "pending") {
      threadsSnap = await threadsRef
        .where("status", "in", ["draft", "pending"])
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    } else if (filter === "reported") {
      threadsSnap = await threadsRef
        .where("reportCount", ">", 0)
        .orderBy("reportCount", "desc")
        .limit(limit)
        .get();
    } else {
      threadsSnap = await threadsRef
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    }

    const threads = threadsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        type: "thread" as const,
        id: doc.id,
        title: d.title || "",
        content: d.content || "",
        authorDisplayName: d.authorDisplayName || "Anonim",
        authorId: d.authorId || null,
        status: d.status || "approved",
        createdAt: toISO(d.createdAt),
        isPinned: d.isPinned ?? false,
        isLocked: d.isLocked ?? false,
        reportCount: d.reportCount || 0,
        postCount: d.postCount || 0,
        categorySlug: d.categorySlug || null,
      };
    });

    // ── Posts ─────────────────────────────────────────────────────────────────
    const postsRef = adminDb.collection("forum_posts");
    let postsSnap;

    if (filter === "pending") {
      postsSnap = await postsRef
        .where("status", "in", ["draft", "pending"])
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    } else if (filter === "reported") {
      postsSnap = await postsRef
        .where("reportCount", ">", 0)
        .orderBy("reportCount", "desc")
        .limit(limit)
        .get();
    } else {
      postsSnap = await postsRef
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    }

    const posts = postsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        type: "post" as const,
        id: doc.id,
        title: undefined,
        content: d.content || d.body || "",
        authorDisplayName: d.authorDisplayName || "Anonim",
        authorId: d.authorId || null,
        status: d.status || "approved",
        createdAt: toISO(d.createdAt),
        isPinned: false,
        isLocked: false,
        reportCount: d.reportCount || 0,
        threadId: d.threadId || null,
      };
    });

    // Merge + sort by createdAt desc
    const items = [...threads, ...posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const counts = {
      total: items.length,
      threads: threads.length,
      posts: posts.length,
      pending: items.filter(i => ["draft", "pending"].includes(i.status)).length,
      reported: items.filter(i => i.reportCount > 0).length,
    };

    return NextResponse.json({ ok: true, items, counts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Forum moderation GET error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


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
