'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, TrendingUp } from 'lucide-react';
import { UserPoints, ReputationLevel } from '@/lib/types';
import { getUserPoints, getUserReputationLevel, REPUTATION_LEVELS } from '@/lib/gamification';

interface UserStatsCardProps {
  userId: string;
}

export function UserStatsCard({ userId }: UserStatsCardProps) {
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [reputationLevel, setReputationLevel] = useState<ReputationLevel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserStats = async () => {
      setLoading(true);
      try {
        const points = await getUserPoints(userId);
        if (points) {
          setUserPoints(points);
          const level = getUserReputationLevel(points.totalPoints);
          setReputationLevel(level);
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statystyki</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ładowanie...</p>
        </CardContent>
      </Card>
    );
  }

  if (!userPoints || !reputationLevel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statystyki</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Brak danych</p>
        </CardContent>
      </Card>
    );
  }

  const progressToNextLevel =
    reputationLevel.maxPoints && userPoints.pointsToNextLevel > 0
      ? ((userPoints.totalPoints - reputationLevel.minPoints) /
          (reputationLevel.maxPoints - reputationLevel.minPoints)) *
        100
      : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span style={{ color: reputationLevel.color }}>{reputationLevel.icon}</span>
          {reputationLevel.name}
        </CardTitle>
        <CardDescription>
          Poziom {reputationLevel.level} • {userPoints.totalPoints} punktów
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress to next level */}
        {reputationLevel.level < REPUTATION_LEVELS.length && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Do następnego poziomu</span>
              <span className="font-semibold">{userPoints.pointsToNextLevel} pkt</span>
            </div>
            <Progress value={progressToNextLevel} className="h-2" />
          </div>
        )}

        {/* Points breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Star className="h-4 w-4" />
            Aktywność
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{userPoints.breakdown.dealSubmissions}</span>
              <span className="text-xs text-muted-foreground">Zgłoszone okazje</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{userPoints.breakdown.productReviews}</span>
              <span className="text-xs text-muted-foreground">Recenzje produktów</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{userPoints.breakdown.comments}</span>
              <span className="text-xs text-muted-foreground">Komentarze</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{userPoints.breakdown.votes}</span>
              <span className="text-xs text-muted-foreground">Głosy</span>
            </div>
          </div>
        </div>

        {/* Rank */}
        {userPoints.rank && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">
                Ranking: <span className="font-bold">#{userPoints.rank}</span> na platformie
              </span>
            </div>
          </div>
        )}

        {/* Perks */}
        {reputationLevel.perks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Korzyści poziomu</h4>
            <div className="flex flex-wrap gap-2">
              {reputationLevel.perks.map((perk, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {perk}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
