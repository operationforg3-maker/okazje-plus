"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Heart,
  MessageSquare,
  ThumbsUp,
  Trophy,
  Star,
  TrendingUp,
  Award,
  Package,
  Tag,
  Clock,
} from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface Activity {
  id: string;
  type: 'favorite' | 'comment' | 'vote' | 'deal_posted' | 'product_review' | 'badge_earned' | 'level_up';
  description: string;
  itemId?: string;
  itemType?: 'deal' | 'product';
  itemTitle?: string;
  timestamp: Date;
  relativeTimestamp?: string; // Client-side calculated relative time
  icon: React.ElementType;
  iconColor: string;
  points?: number;
}

interface ActivityFeedProps {
  userId?: string; // If not provided, uses current user
  maxItems?: number;
  showTitle?: boolean;
}

export function ActivityFeed({ userId, maxItems = 20, showTitle = true }: ActivityFeedProps) {
  const { user } = useAuth();
  const targetUserId = userId || user?.uid;
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  // Calculate relative timestamps on client side to prevent hydration mismatch
  useEffect(() => {
    const updateTimestamps = () => {
      setActivities(prev => prev.map(activity => ({
        ...activity,
        relativeTimestamp: formatTimestamp(activity.timestamp)
      })));
    };

    updateTimestamps();
    // Update timestamps every minute
    const interval = setInterval(updateTimestamps, 60000);
    return () => clearInterval(interval);
  }, [activities.length]); // Only re-run when activities list changes

  const fetchActivities = async () => {
    if (!targetUserId) return;

    setLoading(true);
    try {
      const activityList: Activity[] = [];

      // Fetch favorites
      const favoritesQuery = query(
        collection(db, 'favorites'),
        where('userId', '==', targetUserId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const favoritesSnap = await getDocs(favoritesQuery);
      
      for (const doc of favoritesSnap.docs) {
        const data = doc.data();
        activityList.push({
          id: `fav-${doc.id}`,
          type: 'favorite',
          description: `Dodano do ulubionych: ${data.itemType === 'deal' ? 'okazja' : 'produkt'}`,
          itemId: data.itemId,
          itemType: data.itemType,
          itemTitle: data.itemName,
          timestamp: data.createdAt?.toDate() || new Date(),
          icon: Heart,
          iconColor: 'text-red-500',
        });
      }

      // Fetch recent comments (using collectionGroup)
      const commentsQuery = query(
        collection(db, 'deals'),
        where('createdBy', '==', targetUserId),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const commentsSnap = await getDocs(commentsQuery);
      
      commentsSnap.docs.forEach((doc) => {
        const data = doc.data();
        activityList.push({
          id: `comment-${doc.id}`,
          type: 'comment',
          description: 'Dodano komentarz',
          itemTitle: data.title,
          timestamp: data.createdAt?.toDate() || new Date(),
          icon: MessageSquare,
          iconColor: 'text-blue-500',
        });
      });

      // Fetch user deals posted
      const dealsQuery = query(
        collection(db, 'deals'),
        where('createdBy', '==', targetUserId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const dealsSnap = await getDocs(dealsQuery);
      
      dealsSnap.docs.forEach((doc) => {
        const data = doc.data();
        activityList.push({
          id: `deal-${doc.id}`,
          type: 'deal_posted',
          description: 'Dodano okazję',
          itemId: doc.id,
          itemType: 'deal',
          itemTitle: data.title,
          timestamp: data.createdAt?.toDate() || new Date(),
          icon: Package,
          iconColor: 'text-green-500',
          points: 10,
        });
      });

      // Fetch badges earned
      const badgesQuery = query(
        collection(db, 'user_badges'),
        where('userId', '==', targetUserId),
        orderBy('earnedAt', 'desc'),
        limit(5)
      );
      const badgesSnap = await getDocs(badgesQuery);
      
      badgesSnap.docs.forEach((doc) => {
        const data = doc.data();
        activityList.push({
          id: `badge-${doc.id}`,
          type: 'badge_earned',
          description: `Zdobyto odznakę: ${data.badgeName}`,
          timestamp: data.earnedAt?.toDate() || new Date(),
          icon: Trophy,
          iconColor: 'text-yellow-500',
          points: 50,
        });
      });

      // Fetch point transactions for level ups
      const pointsQuery = query(
        collection(db, 'point_transactions'),
        where('userId', '==', targetUserId),
        where('action', '==', 'level_up'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const pointsSnap = await getDocs(pointsQuery);
      
      pointsSnap.docs.forEach((doc) => {
        const data = doc.data();
        activityList.push({
          id: `levelup-${doc.id}`,
          type: 'level_up',
          description: `Awans na poziom ${data.metadata?.newLevel || ''}`,
          timestamp: data.createdAt?.toDate() || new Date(),
          icon: Star,
          iconColor: 'text-purple-500',
          points: data.points,
        });
      });

      // Sort all activities by timestamp
      activityList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Limit to maxItems
      setActivities(activityList.slice(0, maxItems));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'przed chwilą';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays === 1) return 'wczoraj';
    if (diffDays < 7) return `${diffDays} dni temu`;
    
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Aktywność
            </CardTitle>
            <CardDescription>Twoja ostatnia aktywność na platformie</CardDescription>
          </CardHeader>
        )}
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!targetUserId) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle>Aktywność</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Zaloguj się, aby zobaczyć swoją aktywność
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Aktywność
          </CardTitle>
          <CardDescription>Twoja ostatnia aktywność na platformie</CardDescription>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {activities.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted-foreground text-center py-8">
                Brak aktywności. Zacznij eksplorować okazje!
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-4">
              {activities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className={`mt-0.5 ${activity.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {activity.description}
                      </p>
                      {activity.itemTitle && (
                        <>
                          {activity.itemId ? (
                            <Link
                              href={`/${activity.itemType === 'deal' ? 'deals' : 'products'}/${activity.itemId}`}
                              className="text-sm text-muted-foreground hover:underline truncate block"
                            >
                              {activity.itemTitle}
                            </Link>
                          ) : (
                            <p className="text-sm text-muted-foreground truncate">
                              {activity.itemTitle}
                            </p>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {activity.relativeTimestamp || ''}
                        </p>
                        {activity.points && (
                          <Badge variant="secondary" className="text-xs">
                            +{activity.points} pkt
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
