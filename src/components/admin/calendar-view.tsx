/**
 * Social Media Calendar View
 * Visual calendar for scheduling and managing social posts
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';
import type { SocialPost, SocialPlatform } from '@/lib/types';

interface CalendarViewProps {
  posts: SocialPost[];
  onPostClick?: (post: SocialPost) => void;
  onDateClick?: (date: Date) => void;
}

export function CalendarView({ posts, onPostClick, onDateClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get first day of month and number of days
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, SocialPost[]> = {};

    posts.forEach((post) => {
      let dateStr: string;
      
      if (post.scheduledFor) {
        const scheduledDate = new Date(post.scheduledFor);
        dateStr = scheduledDate.toISOString().split('T')[0];
      } else if (post.postedAt) {
        const postedDate = new Date(post.postedAt);
        dateStr = postedDate.toISOString().split('T')[0];
      } else {
        return; // Skip posts without date
      }

      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(post);
    });

    return grouped;
  }, [posts]);

  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleDateString('pl-PL', {
    month: 'long',
    year: 'numeric',
  });

  // Generate calendar grid
  const calendarDays: (number | null)[] = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const platformColors: Record<SocialPlatform, string> = {
    facebook: 'bg-blue-500',
    instagram: 'bg-pink-500',
    twitter: 'bg-sky-500',
    linkedin: 'bg-blue-700',
    tiktok: 'bg-black',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Kalendarz Postów
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={goToPreviousMonth} variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button onClick={goToToday} variant="outline" size="sm">
              Dziś
            </Button>
            <Button onClick={goToNextMonth} variant="outline" size="sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{monthName}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-muted-foreground p-2"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateStr = `${currentDate.getFullYear()}-${String(
              currentDate.getMonth() + 1
            ).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayPosts = postsByDate[dateStr] || [];
            const isToday =
              new Date().toISOString().split('T')[0] === dateStr;

            return (
              <button
                key={day}
                onClick={() => {
                  const clickedDate = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    day
                  );
                  onDateClick?.(clickedDate);
                }}
                className={`
                  aspect-square p-2 border rounded-lg hover:bg-accent transition-colors
                  ${isToday ? 'border-primary border-2' : ''}
                  ${dayPosts.length > 0 ? 'bg-accent/50' : ''}
                `}
              >
                <div className="text-sm font-semibold mb-1">{day}</div>
                {dayPosts.length > 0 && (
                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPostClick?.(post);
                        }}
                        className={`
                          text-xs px-1 py-0.5 rounded truncate
                          ${platformColors[post.platform]} text-white
                        `}
                        title={post.itemData.title}
                      >
                        {post.itemData.title.slice(0, 10)}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-xs text-center text-muted-foreground">
                        +{dayPosts.length - 3} więcej
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-semibold mb-2">Legenda:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              Zaplanowane
            </Badge>
            <Badge className="bg-blue-500">Facebook</Badge>
            <Badge className="bg-pink-500">Instagram</Badge>
            <Badge className="bg-sky-500">Twitter</Badge>
            <Badge className="bg-blue-700">LinkedIn</Badge>
            <Badge className="bg-black">TikTok</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Day View - Shows all posts scheduled for a specific day
 */
interface DayViewProps {
  date: Date;
  posts: SocialPost[];
  onPostClick?: (post: SocialPost) => void;
}

export function DayView({ date, posts, onPostClick }: DayViewProps) {
  const dateStr = date.toISOString().split('T')[0];
  
  const dayPosts = posts.filter((post) => {
    if (post.scheduledFor) {
      const scheduledDate = new Date(post.scheduledFor);
      return scheduledDate.toISOString().split('T')[0] === dateStr;
    }
    if (post.postedAt) {
      const postedDate = new Date(post.postedAt);
      return postedDate.toISOString().split('T')[0] === dateStr;
    }
    return false;
  });

  const sortedPosts = [...dayPosts].sort((a, b) => {
    const timeA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 
                  a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const timeB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 
                  b.postedAt ? new Date(b.postedAt).getTime() : 0;
    return timeA - timeB;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {date.toLocaleDateString('pl-PL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {sortedPosts.length} {sortedPosts.length === 1 ? 'post' : 'postów'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Brak postów na ten dzień
          </p>
        ) : (
          sortedPosts.map((post) => {
            const time = post.scheduledFor
              ? new Date(post.scheduledFor)
              : post.postedAt
              ? new Date(post.postedAt)
              : null;

            return (
              <button
                key={post.id}
                onClick={() => onPostClick?.(post)}
                className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{post.platform}</Badge>
                      {time && (
                        <span className="text-xs text-muted-foreground">
                          {time.toLocaleTimeString('pl-PL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{post.itemData.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {post.content.text}
                    </p>
                  </div>
                  {post.itemData.image && (
                    <img
                      src={post.itemData.image}
                      alt=""
                      className="w-16 h-16 object-cover rounded ml-3"
                    />
                  )}
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
