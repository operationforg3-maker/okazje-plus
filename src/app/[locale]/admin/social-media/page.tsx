'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TemplatesTab } from '@/components/admin/templates-tab';
import { ManualPublisher } from '@/components/admin/manual-publisher';
import { CalendarView } from '@/components/admin/calendar-view';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  getAllSocialConfigs,
  saveSocialConfig,
  getSocialPosts,
  approveSocialPost,
  cancelSocialPost,
  retrySocialPost,
  getSocialTemplates,
  saveSocialTemplate,
  deleteSocialTemplate,
  getSocialPostStats,
  getPlatformDisplayName,
  getPlatformIcon,
} from '@/lib/social-automation';
import type { SocialConfig, SocialPost, SocialTemplate, SocialPlatform } from '@/lib/types';
import { toast } from 'sonner';
import { 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Music2,
  Save,
  Trash2,
  Check,
  X,
  RefreshCw,
  Eye,
  Settings,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Calendar
} from 'lucide-react';

const PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'];

const PLATFORM_ICONS: Record<SocialPlatform, any> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  tiktok: Music2,
};

export default function SocialMediaAdminPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<Record<string, SocialConfig>>({});
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [templates, setTemplates] = useState<SocialTemplate[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('config');
  const [editingPlatform, setEditingPlatform] = useState<SocialPlatform | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [configsData, postsData, templatesData, statsData] = await Promise.all([
        getAllSocialConfigs(),
        getSocialPosts(undefined, undefined, 100),
        getSocialTemplates(),
        getSocialPostStats(),
      ]);

      const configsMap: Record<string, SocialConfig> = {};
      configsData.forEach(config => {
        configsMap[config.platform] = config;
      });
      setConfigs(configsMap);
      setPosts(postsData);
      setTemplates(templatesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading social media data:', error);
      toast.error('Błąd ładowania danych');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(platform: SocialPlatform, config: Partial<SocialConfig>) {
    try {
      await saveSocialConfig({ ...config, platform });
      toast.success(`Konfiguracja ${getPlatformDisplayName(platform)} zapisana`);
      await loadData();
      setEditingPlatform(null);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Błąd zapisywania konfiguracji');
    }
  }

  async function handleApprovePost(postId: string) {
    try {
      await approveSocialPost(postId, user?.uid || 'admin');
      toast.success('Post zatwierdzony');
      await loadData();
    } catch (error) {
      console.error('Error approving post:', error);
      toast.error('Błąd zatwierdzania posta');
    }
  }

  async function handleCancelPost(postId: string) {
    try {
      await cancelSocialPost(postId, user?.uid);
      toast.success('Post anulowany');
      await loadData();
    } catch (error) {
      console.error('Error cancelling post:', error);
      toast.error('Błąd anulowania posta');
    }
  }

  async function handleRetryPost(postId: string) {
    try {
      await retrySocialPost(postId, user?.uid);
      toast.success('Post ponownie w kolejce');
      await loadData();
    } catch (error) {
      console.error('Error retrying post:', error);
      toast.error('Błąd ponowienia posta');
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Social Media Automation</h1>
        <p className="text-muted-foreground mt-2">
          Zarządzaj automatycznym publikowaniem na platformach społecznościowych
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Wszystkie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Oczekujące
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                Zatwierdzone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Opublikowane
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.posted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Błędy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Konfiguracja
          </TabsTrigger>
          <TabsTrigger value="queue">
            <Send className="h-4 w-4 mr-2" />
            Kolejka Postów ({posts.length})
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Kalendarz
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Eye className="h-4 w-4 mr-2" />
            Szablony ({templates.length})
          </TabsTrigger>
        </TabsList>

        {/* CONFIGURATION TAB */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platformy Społecznościowe</CardTitle>
              <CardDescription>
                Skonfiguruj tokeny dostępu i ustawienia dla każdej platformy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PLATFORMS.map(platform => {
                const config = configs[platform];
                const Icon = PLATFORM_ICONS[platform];
                const isEditing = editingPlatform === platform;

                return (
                  <div key={platform}>
                    <PlatformConfig
                      platform={platform}
                      config={config}
                      isEditing={isEditing}
                      onEdit={() => setEditingPlatform(platform)}
                      onSave={(updatedConfig) => handleSaveConfig(platform, updatedConfig)}
                      onCancel={() => setEditingPlatform(null)}
                    />
                    {platform !== PLATFORMS[PLATFORMS.length - 1] && <Separator className="my-4" />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUEUE TAB */}
        <TabsContent value="queue" className="space-y-4">
          <div className="grid gap-4">
            {posts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Brak postów w kolejce</p>
                </CardContent>
              </Card>
            ) : (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onApprove={handleApprovePost}
                  onCancel={handleCancelPost}
                  onRetry={handleRetryPost}
                  onUpdate={loadData}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* CALENDAR TAB */}
        <TabsContent value="calendar" className="space-y-4">
          <CalendarView
            posts={posts}
            onPostClick={(post) => {
              // Scroll to post in queue or show modal
              console.log('Clicked post:', post);
            }}
            onDateClick={(date) => {
              console.log('Clicked date:', date);
            }}
          />
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-4">
          <TemplatesTab templates={templates} onUpdate={loadData} />
        </TabsContent>

        {/* BULK CREATOR TAB - REMOVED */}
        <TabsContent value="bulk" className="space-y-4">
           <div className="p-4 text-center text-muted-foreground">Moduł masowego tworzenia przeniesiony do archiwum.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Platform Configuration Component
function PlatformConfig({
  platform,
  config,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  platform: SocialPlatform;
  config?: SocialConfig;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (config: Partial<SocialConfig>) => void;
  onCancel: () => void;
}) {
  const Icon = PLATFORM_ICONS[platform];
  const [formData, setFormData] = useState<Partial<SocialConfig>>(config || {
    platform,
    enabled: false,
    credentials: {},
    settings: {
      autoPost: false,
      postFrequency: 15,
      maxPostsPerDay: 10,
      postTypes: ['deal', 'product'],
      includeImage: true,
      includePrice: true,
      addHashtags: true,
      utmParams: {
        source: platform,
        medium: 'social',
        campaign: 'auto_post'
      }
    },
    stats: {
      totalPosts: 0,
      successfulPosts: 0,
      failedPosts: 0
    }
  });

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-muted rounded">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold">{getPlatformDisplayName(platform)}</h3>
            <p className="text-sm text-muted-foreground">
              {config?.enabled ? (
                <Badge variant="default" className="bg-green-500">Aktywna</Badge>
              ) : (
                <Badge variant="secondary">Nieaktywna</Badge>
              )}
              {config?.credentials?.accessToken && (
                <span className="ml-2 text-xs">• Token skonfigurowany</span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={onEdit} variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Konfiguruj
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6" />
          <h3 className="font-semibold text-lg">{getPlatformDisplayName(platform)}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${platform}-enabled`}>Aktywna</Label>
          <Switch
            id={`${platform}-enabled`}
            checked={formData.enabled || false}
            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor={`${platform}-token`}>Access Token</Label>
          <Input
            id={`${platform}-token`}
            type="password"
            placeholder="Wklej token dostępu..."
            value={formData.credentials?.accessToken || ''}
            onChange={(e) => setFormData({
              ...formData,
              credentials: { ...formData.credentials, accessToken: e.target.value }
            })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Zobacz dokumentację jak uzyskać token dla {getPlatformDisplayName(platform)}
          </p>
        </div>

        {(platform === 'facebook' || platform === 'instagram') && (
          <div>
            <Label htmlFor={`${platform}-pageid`}>Page ID</Label>
            <Input
              id={`${platform}-pageid`}
              placeholder="ID strony Facebook/Instagram..."
              value={formData.credentials?.pageId || ''}
              onChange={(e) => setFormData({
                ...formData,
                credentials: { ...formData.credentials, pageId: e.target.value }
              })}
            />
          </div>
        )}

        {platform === 'linkedin' && (
          <div>
            <Label htmlFor={`${platform}-orgid`}>Organization ID</Label>
            <Input
              id={`${platform}-orgid`}
              placeholder="ID organizacji LinkedIn..."
              value={formData.credentials?.organizationId || ''}
              onChange={(e) => setFormData({
                ...formData,
                credentials: { ...formData.credentials, organizationId: e.target.value }
              })}
            />
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Automatyczne publikowanie</Label>
            <Switch
              checked={formData.settings?.autoPost || false}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                settings: { ...formData.settings!, autoPost: checked }
              })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Bez zatwierdzenia admina
            </p>
          </div>
          <div>
            <Label htmlFor={`${platform}-frequency`}>Częstotliwość (min)</Label>
            <Input
              id={`${platform}-frequency`}
              type="number"
              min="5"
              value={formData.settings?.postFrequency || 15}
              onChange={(e) => setFormData({
                ...formData,
                settings: { ...formData.settings!, postFrequency: parseInt(e.target.value) }
              })}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onSave(formData)} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Zapisz
          </Button>
          <Button onClick={onCancel} variant="outline" size="sm">
            Anuluj
          </Button>
        </div>
      </div>
    </div>
  );
}

// Post Card Component
function PostCard({
  post,
  onApprove,
  onCancel,
  onRetry,
  onUpdate
}: {
  post: SocialPost;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onUpdate?: () => void;
}) {
  const Icon = PLATFORM_ICONS[post.platform];
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    approved: 'bg-blue-500',
    posted: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-gray-500'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">{post.itemData.title}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge className={statusColors[post.status]}>
                  {post.status.toUpperCase()}
                </Badge>
                <span className="text-xs">
                  {new Date(post.createdAt).toLocaleString('pl-PL')}
                </span>
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {post.status === 'pending' && (
              <>
                <Button onClick={() => onApprove(post.id)} size="sm" variant="default">
                  <Check className="h-4 w-4" />
                </Button>
                <Button onClick={() => onCancel(post.id)} size="sm" variant="destructive">
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {post.status === 'failed' && (
              <Button onClick={() => onRetry(post.id)} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Ponów
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Content Preview */}
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
              {post.content.text}
            </div>
            {post.itemData.image && (
              <img 
                src={post.itemData.image} 
                alt={post.itemData.title}
                className="w-full max-w-md h-48 object-cover rounded"
              />
            )}
            {post.content.linkUrl && (
              <div className="text-sm text-muted-foreground break-all">
                🔗 {post.content.linkUrl}
              </div>
            )}
            {post.content.hashtags && post.content.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.content.hashtags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {post.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              <strong>Błąd:</strong> {post.error.message}
            </div>
          )}

          {/* Manual Publisher Integration */}
          {(post.status === 'approved' || post.status === 'posted') && (
            <>
              <Separator />
              <ManualPublisher post={post} onUpdate={onUpdate} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
