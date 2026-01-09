/**
 * Manual Publisher Component
 * Provides UI controls for manual post publishing with real-time status
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Send,
  Eye,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { PostPreview } from './post-preview';
import {
  publishSocialPostAction,
  fetchPostAnalyticsAction,
  schedulePostAction,
} from '@/app/actions/publish-social-post';
import type { SocialPost } from '@/lib/types';

interface ManualPublisherProps {
  post: SocialPost;
  onUpdate?: () => void;
}

export function ManualPublisher({ post, onUpdate }: ManualPublisherProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    platformUrl?: string;
    error?: string | { code: string; message: string };
  } | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const canPublish = post.status === 'approved' && !post.postedAt;
  const isPosted = post.status === 'posted' || !!post.postedAt;

  const handlePublish = async () => {
    if (!canPublish) return;

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const result = await publishSocialPostAction(post.id);
      setPublishResult(result);

      if (result.success) {
        // Wait a bit for UI update, then refresh
        setTimeout(() => {
          onUpdate?.();
        }, 1000);
      }
    } catch (error) {
      setPublishResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFetchAnalytics = async () => {
    if (!post.platformPostId) return;

    setIsFetchingAnalytics(true);
    try {
      const result = await fetchPostAnalyticsAction(post.id);
      if (result.success && result.analytics) {
        setAnalytics(result.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsFetchingAnalytics(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        {isPosted ? (
          <>
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Opublikowano
            </Badge>
            {post.platformUrl && (
              <a
                href={post.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline flex items-center gap-1"
              >
                Zobacz post <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        ) : post.scheduledFor ? (
          <Badge variant="outline">
            <Calendar className="h-3 w-3 mr-1" />
            Zaplanowano:{' '}
            {new Date(post.scheduledFor).toLocaleString('pl-PL')}
          </Badge>
        ) : (
          <Badge variant="outline">Gotowy do publikacji</Badge>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Preview Button */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Podgląd
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Podgląd posta</DialogTitle>
              <DialogDescription>
                Zobacz jak post będzie wyglądał na platformie {post.platform}
              </DialogDescription>
            </DialogHeader>
            <PostPreview post={post} />
          </DialogContent>
        </Dialog>

        {/* Publish Button */}
        {canPublish && (
          <Button
            onClick={handlePublish}
            disabled={isPublishing}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publikowanie...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Opublikuj teraz
              </>
            )}
          </Button>
        )}

        {/* Analytics Button */}
        {isPosted && post.platformPostId && (
          <Button
            onClick={handleFetchAnalytics}
            disabled={isFetchingAnalytics}
            variant="outline"
            size="sm"
          >
            {isFetchingAnalytics ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pobieranie...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                Odśwież statystyki
              </>
            )}
          </Button>
        )}
      </div>

      {/* Publish Result */}
      {publishResult && (
        <Alert variant={publishResult.success ? 'default' : 'destructive'}>
          {publishResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {publishResult.success
              ? 'Post został pomyślnie opublikowany!'
              : `Błąd: ${publishResult.error}`}
          </AlertDescription>
        </Alert>
      )}

      {/* Analytics Display */}
      {analytics && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Statystyki
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analytics.reach !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Zasięg</p>
                  <p className="text-2xl font-bold">{analytics.reach.toLocaleString()}</p>
                </div>
              )}
              {analytics.impressions !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Wyświetlenia</p>
                  <p className="text-2xl font-bold">
                    {analytics.impressions.toLocaleString()}
                  </p>
                </div>
              )}
              {analytics.engagement !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Zaangażowanie</p>
                  <p className="text-2xl font-bold">
                    {analytics.engagement.toLocaleString()}
                  </p>
                </div>
              )}
              {analytics.clicks !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Kliknięcia</p>
                  <p className="text-2xl font-bold">{analytics.clicks.toLocaleString()}</p>
                </div>
              )}
              {analytics.likes !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Polubienia</p>
                  <p className="text-2xl font-bold">{analytics.likes.toLocaleString()}</p>
                </div>
              )}
              {analytics.comments !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Komentarze</p>
                  <p className="text-2xl font-bold">
                    {analytics.comments.toLocaleString()}
                  </p>
                </div>
              )}
              {analytics.shares !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Udostępnienia</p>
                  <p className="text-2xl font-bold">{analytics.shares.toLocaleString()}</p>
                </div>
              )}
            </div>
            {analytics.lastUpdated && (
              <p className="text-xs text-muted-foreground mt-3">
                Ostatnia aktualizacja:{' '}
                {new Date(analytics.lastUpdated).toLocaleString('pl-PL')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
