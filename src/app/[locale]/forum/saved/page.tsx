'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface SavedItem {
  id: string;
  userId: string;
  type: 'thread' | 'post';
  threadId?: string;
  postId?: string;
  createdAt: string;
  // Denormalized data from thread/post
  title?: string;
  content?: string;
  authorDisplayName?: string;
}

export default function SavedForumPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadDetails, setThreadDetails] = useState<Map<string, any>>(new Map());
  const [activeTab, setActiveTab] = useState<'threads' | 'posts'>('threads');

  useEffect(() => {
    if (!user) return;

    const fetchSaved = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/forum/favorites');
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        const items = (data.favorites || []).map((item: any) => ({
          ...item,
          createdAt: item.createdAt?.toDate?.() || item.createdAt,
        }));

        setSaved(items);

        // Fetch thread details for display
        const threadIds = new Set(items.map((i: any) => i.threadId).filter(Boolean));
        for (const tid of threadIds) {
          try {
            const threadRes = await fetch(`/api/forum/threads/${tid}`);
            const threadData = await threadRes.json();
            if (threadData.thread) {
              setThreadDetails((prev) => new Map(prev).set(tid, threadData.thread));
            }
          } catch (err) {
            console.error(`Failed to fetch thread ${tid}:`, err);
          }
        }
      } catch (error: any) {
        console.error('Fetch saved error:', error);
        toast.error('Nie udało się załadować zapisanych wątków');
      } finally {
        setLoading(false);
      }
    };

    fetchSaved();
  }, [user]);

  const handleDelete = async (favoriteId: string) => {
    try {
      const res = await fetch('/api/forum/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteId }),
      });

      if (!res.ok) throw new Error('Failed to delete');

      setSaved((prev) => prev.filter((item) => item.id !== favoriteId));
      toast.success('Usunięto z ulubionych');
    } catch (error: any) {
      toast.error(error.message || 'Błąd przy usuwaniu');
    }
  };

  if (!user) {
    return (
      <div className="page-container py-6">
        <p className="text-muted-foreground">Musisz być zalogowany, aby zobaczyć zapisane wątki.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container py-6 space-y-4">
        <h1 className="text-3xl font-bold">Moje zapisane</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const threads = saved.filter((item) => item.type === 'thread');
  const posts = saved.filter((item) => item.type === 'post');

  return (
    <div className="page-container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Moje zapisane</h1>
        <p className="text-muted-foreground mt-1">
          Tutaj znajdziesz wszystkie zapisane wątki i posty z forum
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList>
          <TabsTrigger value="threads">
            Wątki ({threads.length})
          </TabsTrigger>
          <TabsTrigger value="posts">
            Posty ({posts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="threads" className="space-y-4">
          {threads.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nie masz zapisanych wątków. <Link href="/forum" className="underline">Idź do forum</Link>
              </CardContent>
            </Card>
          ) : (
            threads.map((item) => {
              const threadData = threadDetails.get(item.threadId);
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link href={`/forum/${item.threadId}`}>
                          <h3 className="text-lg font-semibold hover:underline truncate">
                            {threadData?.title || 'Wątek'}
                          </h3>
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          {threadData?.authorDisplayName || 'Użytkownik'} •{' '}
                          {new Date(threadData?.createdAt || item.createdAt).toLocaleDateString('pl-PL')}
                        </p>
                        {threadData?.postsCount && (
                          <div className="flex items-center gap-1 mt-2 text-sm">
                            <MessageSquare className="h-4 w-4" />
                            <span>{threadData.postsCount} odpowiedzi</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nie masz zapisanych postów. <Link href="/forum" className="underline">Idź do forum</Link>
              </CardContent>
            </Card>
          ) : (
            posts.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link href={`/forum/${item.threadId}#post-${item.postId}`}>
                        <p className="text-sm line-clamp-2 hover:underline">
                          {item.content || 'Post'}
                        </p>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-2">
                        {item.authorDisplayName || 'Użytkownik'} •{' '}
                        {new Date(item.createdAt).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
