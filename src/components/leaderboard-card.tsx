'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { Leaderboard as LeaderboardType, LeaderboardEntry } from '@/lib/types';
import { getLeaderboard } from '@/lib/gamification';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function LeaderboardCard() {
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<LeaderboardType | null>(null);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardType | null>(null);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<LeaderboardType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboards = async () => {
      setLoading(true);
      try {
        const [weekly, monthly, allTime] = await Promise.all([
          getLeaderboard('weekly'),
          getLeaderboard('monthly'),
          getLeaderboard('all_time'),
        ]);
        setWeeklyLeaderboard(weekly);
        setMonthlyLeaderboard(monthly);
        setAllTimeLeaderboard(allTime);
      } catch (error) {
        console.error('Error fetching leaderboards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboards();
  }, []);

  const renderLeaderboardContent = (leaderboard: LeaderboardType | null) => {
    if (!leaderboard || leaderboard.entries.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Brak danych</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {leaderboard.entries.slice(0, 10).map((entry) => (
          <LeaderboardRow key={entry.userId} entry={entry} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking użytkowników
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ładowanie...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking użytkowników
        </CardTitle>
        <CardDescription>Top współtwórcy społeczności</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weekly">Tydzień</TabsTrigger>
            <TabsTrigger value="monthly">Miesiąc</TabsTrigger>
            <TabsTrigger value="all_time">Zawsze</TabsTrigger>
          </TabsList>
          <TabsContent value="weekly" className="mt-4">
            {renderLeaderboardContent(weeklyLeaderboard)}
          </TabsContent>
          <TabsContent value="monthly" className="mt-4">
            {renderLeaderboardContent(monthlyLeaderboard)}
          </TabsContent>
          <TabsContent value="all_time" className="mt-4">
            {renderLeaderboardContent(allTimeLeaderboard)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBadgeVariant = (rank: number): 'default' | 'secondary' | 'outline' => {
    if (rank <= 3) return 'default';
    if (rank <= 10) return 'secondary';
    return 'outline';
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-center w-8">
        {getRankIcon(entry.rank)}
      </div>
      <Avatar className="h-10 w-10">
        <AvatarImage src={entry.photoURL} alt={entry.displayName} />
        <AvatarFallback>{entry.displayName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{entry.displayName}</p>
        <p className="text-xs text-muted-foreground">
          {entry.contributionCount} {entry.contributionCount === 1 ? 'wkład' : 'wkładów'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={getRankBadgeVariant(entry.rank)} className="font-bold">
          {entry.points} pkt
        </Badge>
        {entry.change && entry.change !== 0 && (
          <Badge
            variant="outline"
            className={entry.change > 0 ? 'text-green-600' : 'text-red-600'}
          >
            {entry.change > 0 ? '↑' : '↓'} {Math.abs(entry.change)}
          </Badge>
        )}
      </div>
    </div>
  );
}
