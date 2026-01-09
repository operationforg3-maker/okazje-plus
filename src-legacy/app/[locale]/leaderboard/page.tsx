'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard } from '@/lib/gamification';
import type { LeaderboardEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const data = await getLeaderboard('all_time');
        if (data?.entries) setEntries(data.entries);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-amber-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-700" />;
    return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-amber-500">👑 Król Okazji</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400">🥈 Wicemistrz</Badge>;
    if (rank === 3) return <Badge className="bg-amber-700">🥉 3 miejsce</Badge>;
    if (rank <= 10) return <Badge variant="secondary">Top 10</Badge>;
    return null;
  };

  return (
    <div className="page-container py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            Ranking Użytkowników
          </h1>
          <p className="text-muted-foreground">
            Najlepsi łowcy okazji w społeczności Okazje Plus
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>🏆 Leaderboard</CardTitle>
            <CardDescription>
              Zdobywaj punkty za dodawanie okazji, komentowanie i aktywność w społeczności
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Leaderboard jest jeszcze pusty. Bądź pierwszym!
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <Link
                    key={entry.userId}
                    href={`/profile/${entry.userId}`}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-center w-12">
                      {getRankIcon(entry.rank)}
                    </div>
                    <Avatar className="h-12 w-12">
                      {entry.photoURL && <AvatarImage src={entry.photoURL} alt={entry.displayName} />}
                      <AvatarFallback>{entry.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{entry.displayName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {entry.contributionCount} wkład
                        </Badge>
                        {getRankBadge(entry.rank)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{entry.points.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">punktów</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Jak zdobywać punkty?</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">+50</p>
                  <p className="text-sm text-muted-foreground">Dodaj okazję</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">+100</p>
                  <p className="text-sm text-muted-foreground">Okazja zatwierdzona</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">+10</p>
                  <p className="text-sm text-muted-foreground">Otrzymany upvote</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">+5</p>
                  <p className="text-sm text-muted-foreground">Dodaj komentarz</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
