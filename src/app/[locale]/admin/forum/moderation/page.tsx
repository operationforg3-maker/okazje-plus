"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { ForumThread, ForumPost } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, 
  XCircle, 
  Pin, 
  PinOff, 
  Lock, 
  Unlock, 
  Trash2, 
  AlertTriangle,
  MessageSquare,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from 'next-intl';

type ModerationItem = {
  type: "thread" | "post";
  id: string;
  title?: string;
  content?: string;
  authorDisplayName?: string;
  status?: string;
  createdAt: string;
  isPinned?: boolean;
  isLocked?: boolean;
  reportCount?: number;
};

export default function ForumModerationPage() {
  const { user } = useAuth();
  const t = useTranslations('admin.common');
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "reported" | "all">("pending");
  const [actionReason, setActionReason] = useState<Record<string, string>>({});

  const formatDateTime = (value: unknown) => {
    if (!value) return "";
    if (value instanceof Date) return value.toLocaleString("pl-PL");
    if (typeof (value as any)?.toDate === "function") {
      return (value as any).toDate().toLocaleString("pl-PL");
    }
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pl-PL");
    }
    if (typeof (value as any)?._seconds === "number") {
      return new Date((value as any)._seconds * 1000).toLocaleString("pl-PL");
    }
    return "";
  };

  useEffect(() => {
    loadModerationQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function loadModerationQueue() {
    setLoading(true);
    try {
      const moderationItems: ModerationItem[] = [];

      // Załaduj wątki
      const threadsRef = collection(db, "forum_threads");
      let threadsQuery;
      
      if (filter === "pending") {
        threadsQuery = query(
          threadsRef,
          where("status", "in", ["draft", "pending"]),
          orderBy("createdAt", "desc"),
          limit(20)
        );
      } else if (filter === "reported") {
        threadsQuery = query(
          threadsRef,
          where("reportCount", ">", 0),
          orderBy("reportCount", "desc"),
          limit(20)
        );
      } else {
        threadsQuery = query(
          threadsRef,
          orderBy("createdAt", "desc"),
          limit(30)
        );
      }

      const threadsSnap = await getDocs(threadsQuery);
      threadsSnap.forEach((doc) => {
        const data = doc.data() as ForumThread;
        moderationItems.push({
          type: "thread",
          id: doc.id,
          title: data.title,
          authorDisplayName: data.authorDisplayName || t('anonymous'),
          status: data.status || "approved",
          createdAt: data.createdAt,
          isPinned: data.isPinned,
          isLocked: data.isLocked,
          reportCount: 0,
        });
      });

      // Załaduj posty
      const postsRef = collection(db, "forum_posts");
      let postsQuery;
      
      if (filter === "pending") {
        postsQuery = query(
          postsRef,
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
          limit(20)
        );
      } else if (filter === "reported") {
        postsQuery = query(
          postsRef,
          where("reportCount", ">", 0),
          orderBy("reportCount", "desc"),
          limit(20)
        );
      } else {
        postsQuery = query(
          postsRef,
          orderBy("createdAt", "desc"),
          limit(30)
        );
      }

      const postsSnap = await getDocs(postsQuery);
      postsSnap.forEach((doc) => {
        const data = doc.data() as ForumPost;
        moderationItems.push({
          type: "post",
          id: doc.id,
          content: data.content,
          authorDisplayName: data.authorDisplayName || t('anonymous'),
          status: data.status || "approved",
          createdAt: data.createdAt,
          reportCount: data.reportCount || 0,
        });
      });

      // Sortuj po dacie utworzenia
      moderationItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setItems(moderationItems);
    } catch (error) {
      console.error("Error loading moderation queue:", error);
      toast.error("Błąd ładowania kolejki moderacji");
    } finally {
      setLoading(false);
    }
  }

  async function performAction(
    action: string,
    targetType: "thread" | "post",
    targetId: string,
    reason?: string
  ) {
    try {
      // Pobierz token z Firebase Auth bezpośrednio
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        toast.error("Brak autoryzacji");
        return;
      }

      const idToken = await firebaseUser.getIdToken();

      const response = await fetch("/api/admin/forum/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action,
          targetType,
          targetId,
          reason: reason || actionReason[targetId] || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Błąd moderacji");
      }

      toast.success(`Akcja ${action} wykonana pomyślnie`);
      
      // Odśwież listę
      await loadModerationQueue();
      
      // Wyczyść reason
      setActionReason((prev) => {
        const updated = { ...prev };
        delete updated[targetId];
        return updated;
      });
    } catch (error: any) {
      console.error("Moderation action error:", error);
      toast.error(error.message || "Błąd wykonywania akcji");
    }
  }

  if (loading) {
    return (
      <div className="page-container py-6">
        <h1 className="text-3xl font-bold mb-6">Moderacja Forum</h1>
        <p>Ładowanie...</p>
      </div>
    );
  }

  const pendingCount = items.filter(i => i.status === "pending" || i.status === "draft").length;
  const reportedCount = items.filter(i => (i.reportCount || 0) > 0).length;

  return (
    <div className="page-container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Moderacja Forum</h1>
        <p className="text-muted-foreground">Zarządzaj wątkami, postami i zgłoszeniami</p>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Oczekujące</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Zgłoszenia</p>
              <p className="text-2xl font-bold">{reportedCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Wątki</p>
              <p className="text-2xl font-bold">{items.filter(i => i.type === "thread").length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Posty</p>
              <p className="text-2xl font-bold">{items.filter(i => i.type === "post").length}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filtry */}
      <div className="flex gap-3">
        <Button
          variant={filter === "pending" ? "default" : "outline"}
          onClick={() => setFilter("pending")}
          className="gap-2"
        >
          Oczekujące
          {pendingCount > 0 && (
            <Badge variant={filter === "pending" ? "secondary" : "default"} className="rounded-full ml-1">
              {pendingCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === "reported" ? "default" : "outline"}
          onClick={() => setFilter("reported")}
          className="gap-2"
        >
          Zgłoszone
          {reportedCount > 0 && (
            <Badge variant="destructive" className="rounded-full ml-1">
              {reportedCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          className="gap-2"
        >
          Wszystkie
          <Badge variant={filter === "all" ? "secondary" : "outline"} className="rounded-full ml-1">
            {items.length}
          </Badge>
        </Button>
      </div>

      {/* Lista elementów */}
      <div className="space-y-4">
        {items.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            Brak elementów do moderacji
          </Card>
        )}

        {items.map((item) => (
          <Card key={`${item.type}-${item.id}`} className="overflow-hidden">
            <div className="flex items-start">
              {/* Kolorowy pasek boczny */}
              <div className={`w-1 self-stretch ${
                item.type === "thread" ? "bg-blue-500" : "bg-green-500"
              }`} />
              
              {/* Główna treść */}
              <div className="flex-1 p-6 flex items-start gap-4">
                {/* Ikona typu */}
                <div className="mt-1">
                  {item.type === "thread" ? (
                    <FileText className="h-6 w-6 text-blue-500" />
                  ) : (
                    <MessageSquare className="h-6 w-6 text-green-500" />
                  )}
                </div>

                {/* Treść */}
                <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">
                    {item.type === "thread" ? t('thread') : t('post')}
                  </Badge>
                  <Badge variant={
                    item.status === "approved" ? "default" :
                    item.status === "pending" || item.status === "draft" ? "secondary" :
                    item.status === "spam" ? "destructive" :
                    "outline"
                  }>
                    {item.status || "approved"}
                  </Badge>
                  {item.isPinned && (
                    <Badge variant="outline" className="gap-1">
                      <Pin className="h-3 w-3" />
                      Przypięty
                    </Badge>
                  )}
                  {item.isLocked && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Zablokowany
                    </Badge>
                  )}
                  {(item.reportCount || 0) > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {item.reportCount} zgłoszeń
                    </Badge>
                  )}
                </div>

                {item.title && (
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                )}
                {item.content && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-3">
                    {item.content}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Autor: {item.authorDisplayName} • {formatDateTime(item.createdAt)}
                </p>

                {/* Pole powodu */}
                <div className="mt-4">
                  <Label htmlFor={`reason-${item.id}`} className="text-xs">
                    Powód akcji (opcjonalnie)
                  </Label>
                  <Textarea
                    id={`reason-${item.id}`}
                    placeholder="Wpisz powód moderacji..."
                    className="mt-1 h-20"
                    value={actionReason[item.id] || ""}
                    onChange={(e) =>
                      setActionReason((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                </div>
                </div>

                {/* Akcje */}
                <div className="flex flex-col gap-2 min-w-[180px]">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => performAction("approve", item.type, item.id)}
                >
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Zatwierdź
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => performAction("reject", item.type, item.id)}
                >
                  <XCircle className="h-4 w-4 text-red-600" />
                  Odrzuć
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => performAction("spam", item.type, item.id)}
                >
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Spam
                </Button>

                {item.type === "thread" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        performAction(
                          item.isPinned ? "unpin" : "pin",
                          item.type,
                          item.id
                        )
                      }
                    >
                      {item.isPinned ? (
                        <>
                          <PinOff className="h-4 w-4" />
                          Odepnij
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4" />
                          Przypnij
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        performAction(
                          item.isLocked ? "unlock" : "lock",
                          item.type,
                          item.id
                        )
                      }
                    >
                      {item.isLocked ? (
                        <>
                          <Unlock className="h-4 w-4" />
                          Odblokuj
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Zablokuj
                        </>
                      )}
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => performAction("delete", item.type, item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Usuń
                </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
