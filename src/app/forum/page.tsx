"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listForumThreads, listForumCategories } from '@/lib/data';
import { ForumThread, ForumCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Tags } from 'lucide-react';

export default function ForumHomePage() {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [cats, th] = await Promise.all([
          listForumCategories().catch(() => []),
          listForumThreads(20).catch(() => []),
        ]);
        if (!mounted) return;
        setCategories(cats);
        setThreads(th);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  const handleCategoryChange = async (categoryId?: string) => {
    setActiveCategory(categoryId || '');
    setLoading(true);
    try {
      const th = await listForumThreads(20, categoryId);
      setThreads(th);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Forum</h1>
          <p className="text-muted-foreground">Pytania, dyskusje, poradniki i prezentacje produktów/okazji</p>
        </div>
        <Button asChild>
          <Link href="/forum/new">Nowy wątek</Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={activeCategory === '' ? 'default' : 'outline'} size="sm" onClick={() => handleCategoryChange(undefined)}>
          Wszystko
        </Button>
        {categories.map((c) => (
          <Button key={c.id} variant={activeCategory === c.id ? 'default' : 'outline'} size="sm" onClick={() => handleCategoryChange(c.id)}>
            {c.name}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Brak wątków w tej kategorii.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  <Link href={`/forum/${t.id}`} className="hover:underline">
                    {t.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {t.authorDisplayName || 'Użytkownik'} • {new Date(t.createdAt).toLocaleString('pl-PL')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground line-clamp-2 max-w-[70%]">
                    {t.summary || ''}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1"><MessageSquare className="h-4 w-4" />{t.postsCount}</div>
                    {t.tags && t.tags.length > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Tags className="h-4 w-4" />
                        {t.tags.slice(0,3).map(tag => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
