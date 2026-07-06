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
import { cn } from '@/lib/utils';

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
        <Input
          placeholder="Szukaj..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 sm:pl-10 text-sm sm:text-base"
        />
      </div>

      {/* Filtry i sortowanie */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
        {/* Sortowanie */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Sortuj:</span>
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
            <SelectTrigger className="w-full sm:w-[140px] h-8 text-sm">
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
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Status:</span>
          <Select value={filterBy} onValueChange={(val) => setFilterBy(val as FilterOption)}>
            <SelectTrigger className="w-full sm:w-[140px] h-8 text-sm">
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
        <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kategorie</h3>
        <div className="flex gap-1 sm:gap-2 flex-wrap">
          <Button variant={activeCategory === '' ? 'default' : 'outline'} size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => handleCategoryChange(undefined)}>
            Wszystko
          </Button>
          {categories.map((c) => (
            <Button key={c.id} variant={activeCategory === c.id ? 'default' : 'outline'} size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => handleCategoryChange(c.id)}>
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
        <Card className="rounded-2xl border border-border/40 bg-background/60 backdrop-blur-md">
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
                        <Card 
                          key={t.id} 
                          className={cn(
                            "rounded-2xl border border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/40",
                            t.isPinned ? "border-blue-500/40 shadow-sm bg-blue-500/5" : ""
                          )}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm sm:text-base flex items-center gap-1 sm:gap-2 flex-wrap">
                              <Link href={`/forum/${t.id}`} className="hover:text-primary transition-colors break-words font-semibold">
                                {t.title}
                              </Link>
                              {t.isPinned && (
                                <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-blue-500/10 text-blue-500 border-blue-500/30 font-medium">
                                  <Pin className="h-3 w-3" />
                                  <span>Przypięty</span>
                                </Badge>
                              )}
                              {t.isLocked && (
                                <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-red-500/10 text-red-500 border-red-500/30 font-medium">
                                  <Lock className="h-3 w-3" />
                                  <span>Zablokowany</span>
                                </Badge>
                              )}
                              {t.bestAnswerId && (
                                <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-green-500/10 text-green-500 border-green-500/30 font-medium">
                                  <Award className="h-3 w-3" />
                                  <span>Rozwiązany</span>
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                              {t.authorDisplayName || 'Użytkownik'} • {new Date(t.createdAt).toLocaleString('pl-PL')}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between">
                              <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 flex-1">
                                {t.summary || ''}
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-shrink-0">
                                <div className="flex items-center gap-1 whitespace-nowrap"><MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />{t.postsCount}</div>
                                {t.tags && t.tags.length > 0 && (
                                  <div className="hidden sm:flex items-center gap-1 text-muted-foreground">
                                    <Tags className="h-3 w-3 sm:h-4 sm:w-4" />
                                    {t.tags.slice(0,2).map(tag => (
                                      <Badge key={tag} variant="outline" className="text-xs py-0 px-1">{tag}</Badge>
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
                      <Card 
                        key={t.id} 
                        className={cn(
                          "rounded-2xl border border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/40",
                          t.isPinned ? "border-blue-500/40 shadow-sm bg-blue-500/5" : ""
                        )}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm sm:text-base flex items-center gap-1 sm:gap-2 flex-wrap">
                            <Link href={`/forum/${t.id}`} className="hover:text-primary transition-colors break-words font-semibold">
                              {t.title}
                            </Link>
                            {t.isPinned && (
                              <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-blue-500/10 text-blue-500 border-blue-500/30 font-medium">
                                <Pin className="h-3 w-3" />
                                <span>Przypięty</span>
                              </Badge>
                            )}
                            {t.isLocked && (
                              <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-red-500/10 text-red-500 border-red-500/30 font-medium">
                                <Lock className="h-3 w-3" />
                                <span>Zablokowany</span>
                              </Badge>
                            )}
                            {t.bestAnswerId && (
                              <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-green-500/10 text-green-500 border-green-500/30 font-medium">
                                <Award className="h-3 w-3" />
                                <span>Rozwiązany</span>
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            {t.authorDisplayName || 'Użytkownik'} • {new Date(t.createdAt).toLocaleString('pl-PL')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between">
                            <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 flex-1">
                              {t.summary || ''}
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-shrink-0">
                              <div className="flex items-center gap-1 whitespace-nowrap"><MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />{t.postsCount}</div>
                              {t.tags && t.tags.length > 0 && (
                                <div className="hidden sm:flex items-center gap-1 text-muted-foreground">
                                  <Tags className="h-3 w-3 sm:h-4 sm:w-4" />
                                  {t.tags.slice(0,2).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs py-0 px-1">{tag}</Badge>
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
              <Card 
                key={t.id} 
                className={cn(
                  "rounded-2xl border border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/40",
                  t.isPinned ? "border-blue-500/40 shadow-sm bg-blue-500/5" : ""
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-1 sm:gap-2 flex-wrap">
                    <Link href={`/forum/${t.id}`} className="hover:text-primary transition-colors break-words font-semibold">
                      {t.title}
                    </Link>
                    {categoryLabel && (
                      <Badge variant="secondary" className="text-xs py-0.5 px-2 bg-secondary/50 text-foreground font-medium">{categoryLabel}</Badge>
                    )}
                    {t.isPinned && (
                      <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-blue-500/10 text-blue-500 border-blue-500/30 font-medium">
                        <Pin className="h-3 w-3" />
                        <span>Przypięty</span>
                      </Badge>
                    )}
                    {t.isLocked && (
                      <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-red-500/10 text-red-500 border-red-500/30 font-medium">
                        <Lock className="h-3 w-3" />
                        <span>Zablokowany</span>
                      </Badge>
                    )}
                    {t.bestAnswerId && (
                      <Badge variant="outline" className="gap-0.5 text-xs py-0.5 px-2 bg-green-500/10 text-green-500 border-green-500/30 font-medium">
                        <Award className="h-3 w-3" />
                        <span>Rozwiązany</span>
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t.authorDisplayName || 'Użytkownik'} • {new Date(t.createdAt).toLocaleString('pl-PL')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between">
                    <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 flex-1">
                      {t.summary || ''}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-shrink-0">
                      <div className="flex items-center gap-1 whitespace-nowrap"><MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />{t.postsCount}</div>
                      {t.tags && t.tags.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1 text-muted-foreground">
                          <Tags className="h-3 w-3 sm:h-4 sm:w-4" />
                          {t.tags.slice(0,2).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs py-0 px-1">{tag}</Badge>
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
