"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ForumThread, ForumCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Tags, Pin, Lock, Award, Search, Bookmark } from 'lucide-react';

type SortOption = 'newest' | 'popular' | 'unanswered';
type FilterOption = 'all' | 'answered' | 'unanswered' | 'pinned';

export default function ForumHomePage() {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<ForumThread[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [catsRes, threadsRes] = await Promise.all([
          fetch('/api/forum/categories', { cache: 'no-store' }),
          fetch('/api/forum/threads?limit=100', { cache: 'no-store' }),
        ]);

        const catsJson = await catsRes.json().catch(() => ({ categories: [] }));
        const threadsJson = await threadsRes.json().catch(() => ({ threads: [] }));

        if (!mounted) return;
        setCategories(Array.isArray(catsJson?.categories) ? catsJson.categories : []);
        setThreads(Array.isArray(threadsJson?.threads) ? threadsJson.threads : []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  // Sortowanie i filtrowanie w czasie rzeczywistym
  useEffect(() => {
    let result = [...threads];

    // Filtruj po kategorii
    if (activeCategory) {
      result = result.filter(t => t.categoryId === activeCategory);
    }

    // Filtruj po statusie odpowiedzi
    if (filterBy === 'answered') {
      result = result.filter(t => t.bestAnswerId);
    } else if (filterBy === 'unanswered') {
      result = result.filter(t => !t.bestAnswerId);
    } else if (filterBy === 'pinned') {
      result = result.filter(t => t.isPinned);
    }

    // Filtruj po wyszukiwaniu
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.summary?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sortuj
    if (sortBy === 'newest') {
      result.sort((a, b) => {
        // Przypięte zawsze na górze
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortBy === 'popular') {
      result.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.postsCount || 0) - (a.postsCount || 0);
      });
    } else if (sortBy === 'unanswered') {
      result.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Nierozwiązane najpierw
        if (!a.bestAnswerId && b.bestAnswerId) return -1;
        if (a.bestAnswerId && !b.bestAnswerId) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    setFilteredThreads(result);
  }, [threads, activeCategory, sortBy, filterBy, searchQuery]);

  const handleCategoryChange = (categoryId?: string) => {
    setActiveCategory(categoryId || '');
  };

  return (
    <div className="page-container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Forum</h1>
          <p className="text-muted-foreground">Pytania, dyskusje, poradniki i prezentacje produktów/okazji</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/forum/saved" className="gap-1">
              <Bookmark className="h-4 w-4" />
              Moje zapisane
            </Link>
          </Button>
          <Button asChild>
            <Link href="/forum/new">Nowy wątek</Link>
          </Button>
        </div>
      </div>

      {/* Wyszukiwanie */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj wątków..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filtry i sortowanie */}
      <div className="flex gap-4 flex-wrap items-center">
        {/* Sortowanie */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sortuj:</span>
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Najnowsze</SelectItem>
              <SelectItem value="popular">Popularne</SelectItem>
              <SelectItem value="unanswered">Nierozwiązane</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtr statusu */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Select value={filterBy} onValueChange={(val) => setFilterBy(val as FilterOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="answered">Rozwiązane</SelectItem>
              <SelectItem value="unanswered">Nierozwiązane</SelectItem>
              <SelectItem value="pinned">Przypięte</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kategorie */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kategorie</h3>
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
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : filteredThreads.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {searchQuery ? `Brak wyników dla "${searchQuery}"` : 'Brak wątków w tej kategorii.'}
          </CardContent>
        </Card>
      ) : activeCategory === '' && filteredThreads.length > 0 ? (
        <div className="space-y-6">
          {/* Grupowanie według kategorii gdy wybrano "Wszystko" */}
          {(() => {
            const grouped = new Map<string, typeof filteredThreads>();
            const uncategorized: typeof filteredThreads = [];
            
            filteredThreads.forEach((t) => {
              if (!t.categoryId) {
                uncategorized.push(t);
              } else {
                if (!grouped.has(t.categoryId)) {
                  grouped.set(t.categoryId, []);
                }
                grouped.get(t.categoryId)!.push(t);
              }
            });

            return (
              <>
                {Array.from(grouped.entries()).map(([catId, threads]) => {
                  const catName = categoryMap.get(catId) || 'Inna kategoria';
                  return (
                    <div key={catId} className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/20">
                        <h2 className="text-lg font-semibold">{catName}</h2>
                        <Badge variant="secondary" className="rounded-full">{threads.length}</Badge>
                      </div>
                      {threads.map((t) => (
                        <Card key={t.id} className={t.isPinned ? "border-blue-500" : ""}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Link href={`/forum/${t.id}`} className="hover:underline">
                                {t.title}
                              </Link>
                              {t.isPinned && (
                                <Badge variant="outline" className="gap-1">
                                  <Pin className="h-3 w-3" />
                                  Przypięty
                                </Badge>
                              )}
                              {t.isLocked && (
                                <Badge variant="destructive" className="gap-1">
                                  <Lock className="h-3 w-3" />
                                  Zablokowany
                                </Badge>
                              )}
                              {t.bestAnswerId && (
                                <Badge variant="default" className="gap-1 bg-green-600">
                                  <Award className="h-3 w-3" />
                                  Rozwiązany
                                </Badge>
                              )}
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
                  );
                })}
                {uncategorized.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-muted">
                      <h2 className="text-lg font-semibold text-muted-foreground">Bez kategorii</h2>
                      <Badge variant="outline" className="rounded-full">{uncategorized.length}</Badge>
                    </div>
                    {uncategorized.map((t) => (
                      <Card key={t.id} className={t.isPinned ? "border-blue-500" : ""}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Link href={`/forum/${t.id}`} className="hover:underline">
                              {t.title}
                            </Link>
                            {t.isPinned && (
                              <Badge variant="outline" className="gap-1">
                                <Pin className="h-3 w-3" />
                                Przypięty
                              </Badge>
                            )}
                            {t.isLocked && (
                              <Badge variant="destructive" className="gap-1">
                                <Lock className="h-3 w-3" />
                                Zablokowany
                              </Badge>
                            )}
                            {t.bestAnswerId && (
                              <Badge variant="default" className="gap-1 bg-green-600">
                                <Award className="h-3 w-3" />
                                Rozwiązany
                              </Badge>
                            )}
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
              </>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredThreads.map((t) => {
            const categoryLabel = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
            return (
              <Card key={t.id} className={t.isPinned ? "border-blue-500" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link href={`/forum/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                    {categoryLabel && (
                      <Badge variant="secondary">{categoryLabel}</Badge>
                    )}
                    {t.isPinned && (
                      <Badge variant="outline" className="gap-1">
                        <Pin className="h-3 w-3" />
                        Przypięty
                      </Badge>
                    )}
                    {t.isLocked && (
                      <Badge variant="destructive" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Zablokowany
                      </Badge>
                    )}
                    {t.bestAnswerId && (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <Award className="h-3 w-3" />
                        Rozwiązany
                      </Badge>
                    )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
