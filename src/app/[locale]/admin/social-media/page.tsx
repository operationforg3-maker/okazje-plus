'use client';

import { useState, useEffect, useCallback } from 'react';
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
import {
  getAllSocialConfigs,
  saveSocialConfig,
  getSocialPosts,
  approveSocialPost,
  cancelSocialPost,
  retrySocialPost,
  getSocialTemplates,
  getSocialPostStats,
  getPlatformDisplayName,
  getSafeSocialString,
} from '@/lib/social-automation';
import type { SocialConfig, SocialPost, SocialTemplate, SocialPlatform, SocialPostStatus } from '@/lib/types';
import { toast } from 'sonner';
import { 
  createAndPublishFacebookTestPostAction,
  updateSocialPostAction,
  deleteSocialPostAction,
  savePostAsTemplateAction,
  publishSocialPostAction,
  validateFacebookCredentialsAction
} from '@/app/actions/publish-social-post';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SocialAIBotsPanel } from '@/components/admin/social-ai-bots-panel';
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
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Bot,
  Edit3,
  BookmarkPlus,
  Sparkles,
  ExternalLink,
  Filter
} from 'lucide-react';

const PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'];

type SocialPostStats = {
  total: number;
  pending: number;
  approved: number;
  posted: number;
  failed: number;
  byPlatform: Record<SocialPlatform, number>;
};

const STATUS_LABELS: Record<SocialPostStatus, string> = {
  pending: 'Oczekuje',
  approved: 'Zatwierdzony',
  posting: 'Publikowanie',
  posted: 'Opublikowany',
  failed: 'Błąd',
  cancelled: 'Anulowany',
};

const PLATFORM_ICONS: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  tiktok: Music2,
};

export default function SocialMediaAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [configs, setConfigs] = useState<Record<string, SocialConfig>>({});
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [templates, setTemplates] = useState<SocialTemplate[]>([]);
  const [stats, setStats] = useState<SocialPostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('config');
  const [editingPlatform, setEditingPlatform] = useState<SocialPlatform | null>(null);
  const [publishingFacebookTest, setPublishingFacebookTest] = useState(false);
  const [validatingFb, setValidatingFb] = useState(false);
  const [fbValidationResult, setFbValidationResult] = useState<{
    valid: boolean;
    pageName?: string;
    pageId?: string;
    permissions?: string[];
    error?: string;
  } | null>(null);

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    loadData();
  }, [authLoading, user?.role, loadData]);

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

  async function handleDeletePost(postId: string) {
    if (!confirm('Czy na pewno chcesz bezpowrotnie usunąć ten post z kolejki?')) return;
    try {
      const res = await deleteSocialPostAction(postId);
      if (!res.success) {
        toast.error(res.error || 'Nie udało się usunąć posta');
        return;
      }
      toast.success('Post został trwale usunięty z kolejki');
      await loadData();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Błąd usuwania posta');
    }
  }

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const filteredPosts = posts.filter(post => {
    if (statusFilter === 'all') return true;
    return post.status === statusFilter;
  });

  async function handleValidateFacebook(token?: string, pageId?: string) {
    try {
      setValidatingFb(true);
      setFbValidationResult(null);
      const res = await validateFacebookCredentialsAction(token, pageId);
      setFbValidationResult(res);
      if (res.valid) {
        toast.success(`Token poprawny! Strona: ${res.pageName || res.pageId}`);
      } else {
        toast.error(`Błąd walidacji: ${res.error || 'Nieprawidłowy token lub ID strony'}`);
      }
    } catch (error: any) {
      toast.error(`Błąd walidacji: ${error?.message || 'Nieoczekiwany błąd'}`);
    } finally {
      setValidatingFb(false);
    }
  }

  async function handlePublishFacebookTestPost() {
    try {
      setPublishingFacebookTest(true);
      const result = await createAndPublishFacebookTestPostAction();

      if (!result.success) {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Nie udało się opublikować testowego posta.';
        toast.error(errorMessage);
        return;
      }

      toast.success('Testowy post na Facebooku został opublikowany.');
      await loadData();
      setSelectedTab('queue');
    } catch (error) {
      console.error('Error publishing Facebook test post:', error);
      toast.error('Wystąpił błąd podczas publikacji testowego posta.');
    } finally {
      setPublishingFacebookTest(false);
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

  if (!authLoading && user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Brak dostępu</CardTitle>
            <CardDescription>
              Tylko administrator ma dostęp do sekcji automatyzacji social mediów.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Automatyzacja social mediów</h1>
        <p className="text-muted-foreground mt-2">
          Zarządzaj automatycznym publikowaniem na platformach społecznościowych.
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
          <TabsTrigger value="ai-bots">
            <Bot className="h-4 w-4 mr-2" />
            AI Boty & Grupa FB
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
              <CardTitle className="flex items-center gap-2">
                <Facebook className="h-5 w-5 text-blue-600" />
                Diagnostyka i Test publikacji Facebook
              </CardTitle>
              <CardDescription>
                Zweryfikuj ważność Page Access Token, uprawnienia strony oraz wykonaj próbny post testowy bezpośrednio na Facebooka.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleValidateFacebook()}
                  disabled={validatingFb}
                >
                  {validatingFb ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Weryfikowanie tokena...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2 text-green-600" />
                      Sprawdź token i uprawnienia FB
                    </>
                  )}
                </Button>

                <Button
                  onClick={handlePublishFacebookTestPost}
                  disabled={publishingFacebookTest}
                >
                  {publishingFacebookTest ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Publikowanie testu...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Opublikuj testowy post na Facebooku
                    </>
                  )}
                </Button>
              </div>

              {fbValidationResult && (
                <div
                  className={`p-4 rounded-lg border text-sm ${
                    fbValidationResult.valid
                      ? 'bg-green-500/10 border-green-500/30 text-green-800 dark:text-green-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
                  }`}
                >
                  {fbValidationResult.valid ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span>Token poprawny! Połączono ze stroną: <strong>{fbValidationResult.pageName}</strong> (ID: {fbValidationResult.pageId})</span>
                      </div>
                      {fbValidationResult.permissions && fbValidationResult.permissions.length > 0 && (
                        <p className="text-xs opacity-90 pl-6">
                          Aktywne uprawnienia API: {fbValidationResult.permissions.join(', ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Błąd weryfikacji tokena Facebooka:</span>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-400 font-mono pl-6 mt-1 break-all">
                        {fbValidationResult.error}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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
          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtruj status:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: `Wszystkie (${posts.length})` },
                { id: 'pending', label: `Oczekujące (${posts.filter(p => p.status === 'pending').length})` },
                { id: 'approved', label: `Zatwierdzone (${posts.filter(p => p.status === 'approved').length})` },
                { id: 'posted', label: `Opublikowane (${posts.filter(p => p.status === 'posted').length})` },
                { id: 'failed', label: `Błędy (${posts.filter(p => p.status === 'failed').length})` },
                { id: 'cancelled', label: `Anulowane (${posts.filter(p => p.status === 'cancelled').length})` },
              ].map(f => (
                <Button
                  key={f.id}
                  variant={statusFilter === f.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {filteredPosts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-48">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">Brak postów w wybranej kategorii</p>
                </CardContent>
              </Card>
            ) : (
              filteredPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onApprove={handleApprovePost}
                  onCancel={handleCancelPost}
                  onRetry={handleRetryPost}
                  onDelete={handleDeletePost}
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
            onPostClick={() => setSelectedTab('queue')}
            onDateClick={() => setSelectedTab('queue')}
          />
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-4">
          <TemplatesTab templates={templates} onUpdate={loadData} />
        </TabsContent>

        {/* AI BOTS & GROUP TAB */}
        <TabsContent value="ai-bots" className="space-y-4">
          <SocialAIBotsPanel />
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

  const [testingToken, setTestingToken] = useState(false);
  const [inlineStatus, setInlineStatus] = useState<{ valid: boolean; pageName?: string; error?: string } | null>(null);

  async function handleTestToken() {
    try {
      setTestingToken(true);
      setInlineStatus(null);
      const res = await validateFacebookCredentialsAction(
        formData.credentials?.accessToken,
        formData.credentials?.pageId
      );
      setInlineStatus(res);
      if (res.valid) {
        toast.success(`Token zweryfikowany pomyślnie! Strona: ${res.pageName}`);
      } else {
        toast.error(`Błąd weryfikacji tokena: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(`Błąd: ${err.message}`);
    } finally {
      setTestingToken(false);
    }
  }

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
          <Label htmlFor={`${platform}-token`}>Token dostępu</Label>
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
            <Label htmlFor={`${platform}-pageid`}>ID strony</Label>
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

        {platform === 'facebook' && (
          <div className="p-3 bg-background/80 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Sprawdź czy token i Page ID są sprawne w Meta API:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingToken || !formData.credentials?.accessToken}
                onClick={handleTestToken}
              >
                {testingToken ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                )}
                Sprawdź poprawność danych FB
              </Button>
            </div>
            {inlineStatus && (
              <p className={`text-xs font-medium ${inlineStatus.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {inlineStatus.valid
                  ? `✓ Połączono pomyślnie ze stroną: ${inlineStatus.pageName}`
                  : `✗ Błąd: ${inlineStatus.error}`}
              </p>
            )}
          </div>
        )}

        {platform === 'linkedin' && (
          <div>
            <Label htmlFor={`${platform}-orgid`}>ID organizacji</Label>
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
  onDelete,
  onUpdate
}: {
  post: SocialPost;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: () => void;
}) {
  const Icon = PLATFORM_ICONS[post.platform] || Facebook;
  const statusColors: Record<SocialPostStatus, string> = {
    pending: 'bg-yellow-500',
    approved: 'bg-blue-500',
    posting: 'bg-sky-500',
    posted: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-gray-500'
  };

  // Edit post state
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.content?.text || '');
  const [editTitle, setEditTitle] = useState(getSafeSocialString(post.itemData?.title) || '');
  const [editLinkUrl, setEditLinkUrl] = useState(post.content?.linkUrl || '');
  const [editImageUrl, setEditImageUrl] = useState(post.itemData?.image || post.content?.imageUrl || '');
  const [editHashtags, setEditHashtags] = useState(
    Array.isArray(post.content?.hashtags) ? post.content.hashtags.join(' ') : (post.content?.hashtags || '')
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState(
    `Wzorzec: ${getSafeSocialString(post.itemData?.title).slice(0, 30) || 'Nowy Wzorzec'}`
  );
  const [templateContent, setTemplateContent] = useState(post.content?.text || '');
  const [templateHashtags, setTemplateHashtags] = useState(
    Array.isArray(post.content?.hashtags) ? post.content.hashtags.join(' ') : (post.content?.hashtags || '')
  );
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    setEditText(post.content?.text || '');
    setEditTitle(getSafeSocialString(post.itemData?.title) || '');
    setEditLinkUrl(post.content?.linkUrl || '');
    setEditImageUrl(post.itemData?.image || post.content?.imageUrl || '');
    setEditHashtags(Array.isArray(post.content?.hashtags) ? post.content.hashtags.join(' ') : (post.content?.hashtags || ''));
  }, [post]);

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const hashtagsArray = editHashtags
        .split(/[,\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.startsWith('#') ? t : `#${t}`);

      const result = await updateSocialPostAction(post.id, {
        title: editTitle,
        text: editText,
        linkUrl: editLinkUrl,
        imageUrl: editImageUrl,
        hashtags: hashtagsArray,
      });

      if (!result.success) {
        toast.error(result.error || 'Nie udało się zapisać zmian');
        return;
      }

      toast.success('Zmiany w poście zostały pomyślnie zapisane');
      setIsEditing(false);
      onUpdate?.();
    } catch (err) {
      console.error('Error updating post:', err);
      toast.error('Błąd podczas zapisywania zmian');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPublishNow = async () => {
    try {
      setPublishing(true);
      const hashtagsArray = editHashtags
        .split(/[,\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.startsWith('#') ? t : `#${t}`);

      const saveRes = await updateSocialPostAction(post.id, {
        title: editTitle,
        text: editText,
        linkUrl: editLinkUrl,
        imageUrl: editImageUrl,
        hashtags: hashtagsArray,
        status: 'approved',
      });

      if (!saveRes.success) {
        toast.error(saveRes.error || 'Błąd zapisu przed publikacją');
        return;
      }

      const pubRes = await publishSocialPostAction(post.id);
      if (!pubRes.success) {
        const errMsg = typeof pubRes.error === 'string' ? pubRes.error : pubRes.error?.message || 'Błąd publikacji';
        toast.error(`Nie udało się opublikować: ${errMsg}`);
        setIsEditing(false);
        onUpdate?.();
        return;
      }

      toast.success('Post zaktualizowany i opublikowany na Facebooku!');
      setIsEditing(false);
      onUpdate?.();
    } catch (err) {
      console.error('Error publishing post:', err);
      toast.error('Wystąpił błąd podczas publikacji');
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Podaj nazwę wzorca');
      return;
    }
    try {
      setSavingTemplate(true);
      const res = await savePostAsTemplateAction(
        post.id,
        templateName,
        templateContent,
        templateHashtags
      );
      if (!res.success) {
        toast.error(res.error || 'Nie udało się zapisać wzorca');
        return;
      }
      toast.success('Wzorzec zapisany! Znajdziesz go w zakładce Szablony');
      setShowTemplateModal(false);
      onUpdate?.();
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Błąd zapisu wzorca');
    } finally {
      setSavingTemplate(false);
    }
  };

  const insertVariable = (varName: string) => {
    setTemplateContent(prev => prev + varName);
  };

  return (
    <Card className="transition-all duration-150">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-md">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base leading-snug">
                {getSafeSocialString(post.itemData?.title) || 'Post bez tytułu'}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge className={statusColors[post.status]}>
                  {STATUS_LABELS[post.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleString('pl-PL')}
                </span>
                {post.metadata?.botName && (
                  <Badge variant="outline" className="text-xs font-normal">
                    🤖 {post.metadata.botName}
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-1.5 self-end sm:self-auto">
            {!isEditing && (
              <>
                <Button
                  onClick={() => setIsEditing(true)}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  title="Edytuj treść posta przed publikacją"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Edytuj
                </Button>

                <Button
                  onClick={() => {
                    setTemplateContent(post.content?.text || '');
                    setTemplateName(`Wzorzec: ${getSafeSocialString(post.itemData?.title).slice(0, 30) || 'Nowy Wzorzec'}`);
                    setShowTemplateModal(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                  title="Zapisz ten post jako wzorzec / szablon"
                >
                  <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                  Zapisz wzór
                </Button>
              </>
            )}

            {post.status === 'pending' && !isEditing && (
              <>
                <Button 
                  onClick={() => onApprove(post.id)} 
                  size="sm" 
                  variant="default"
                  className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                  title="Zatwierdź do publikacji"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Zatwierdź
                </Button>
                <Button 
                  onClick={() => onCancel(post.id)} 
                  size="sm" 
                  variant="outline"
                  className="h-8 text-xs text-muted-foreground"
                  title="Anuluj publikację"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {post.status === 'failed' && !isEditing && (
              <Button onClick={() => onRetry(post.id)} size="sm" variant="outline" className="h-8 text-xs">
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Ponów
              </Button>
            )}

            {!isEditing && onDelete && (
              <Button
                onClick={() => onDelete(post.id)}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                title="Usuń trwale ten post z kolejki"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          /* ================= EDIT MODE ================= */
          <div className="space-y-4 p-4 border rounded-lg bg-muted/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Edit3 className="h-3.5 w-3.5" />
                Tryb edycji posta przed publikacją
              </span>
              <span className="text-xs text-muted-foreground">
                Długość tekstu: {editText.length} znaków
              </span>
            </div>

            <div>
              <Label htmlFor={`edit-title-${post.id}`} className="text-xs font-medium">
                Tytuł okazji / produktu
              </Label>
              <Input
                id={`edit-title-${post.id}`}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="np. Klocki LEGO Technic 42151"
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor={`edit-text-${post.id}`} className="text-xs font-medium">
                  Treść posta (Facebook / Grupa)
                </Label>
                <div className="flex gap-1 text-xs">
                  <button 
                    type="button" 
                    onClick={() => setEditText(prev => prev + '\n🔥 GORĄCA OKAZJA: ')} 
                    className="px-1.5 py-0.5 bg-muted rounded border text-muted-foreground hover:text-foreground"
                  >
                    +🔥 Nagłówek
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditText(prev => prev + '\n👉 Sprawdź szczegóły w 1. komentarzu!')} 
                    className="px-1.5 py-0.5 bg-muted rounded border text-muted-foreground hover:text-foreground"
                  >
                    +👉 CTA
                  </button>
                </div>
              </div>
              <Textarea
                id={`edit-text-${post.id}`}
                rows={6}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                placeholder="Wpisz treść posta..."
                className="font-sans text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`edit-link-${post.id}`} className="text-xs font-medium">
                  Link docelowy do okazji
                </Label>
                <Input
                  id={`edit-link-${post.id}`}
                  value={editLinkUrl}
                  onChange={e => setEditLinkUrl(e.target.value)}
                  placeholder="https://okazjeplus.pl/pl/deals/..."
                  className="mt-1 text-xs"
                />
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  Bot automatycznie wstawi ten link jako 1. komentarz pod postem!
                </p>
              </div>

              <div>
                <Label htmlFor={`edit-image-${post.id}`} className="text-xs font-medium">
                  URL zdjęcia oferty
                </Label>
                <Input
                  id={`edit-image-${post.id}`}
                  value={editImageUrl}
                  onChange={e => setEditImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 text-xs"
                />
                {editImageUrl && (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    Podgląd: {editImageUrl}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor={`edit-hashtags-${post.id}`} className="text-xs font-medium">
                Hashtagi (oddziel spacją)
              </Label>
              <Input
                id={`edit-hashtags-${post.id}`}
                value={editHashtags}
                onChange={e => setEditHashtags(e.target.value)}
                placeholder="#okazje #promocje #okazjeplus"
                className="mt-1 text-xs"
              />
            </div>

            {/* Edit actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditText(post.content?.text || '');
                  setEditTitle(getSafeSocialString(post.itemData?.title) || '');
                  setIsEditing(false);
                }}
                disabled={saving || publishing}
              >
                <X className="h-4 w-4 mr-1.5" />
                Anuluj
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveEdit}
                  size="sm"
                  variant="default"
                  disabled={saving || publishing}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Zapisz zmiany
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSaveAndPublishNow}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={saving || publishing}
                >
                  {publishing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Publikowanie na FB...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Zapisz i Opublikuj teraz
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ================= VIEW MODE ================= */
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap leading-relaxed">
                {post.content.text}
              </div>

              {post.itemData.image && (
                <div className="relative group max-w-md overflow-hidden rounded-md border">
                  <img 
                    src={post.itemData.image} 
                    alt={getSafeSocialString(post.itemData?.title)}
                    className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              )}

              {post.content.linkUrl && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/60 p-2 rounded">
                  <span>🔗 Link okazji (będzie w 1. komentarzu):</span>
                  <a 
                    href={post.content.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary underline font-medium truncate hover:text-primary/80"
                  >
                    {post.content.linkUrl}
                  </a>
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
        )}

        {/* Dialog Zapisz jako wzorzec */}
        <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookmarkPlus className="h-5 w-5 text-blue-500" />
                Zapisz post jako wzorzec / szablon
              </DialogTitle>
              <DialogDescription>
                Wzorzec zostanie zapisany w zakładce <strong>Szablony</strong>. Możesz używać zmiennych takich jak &#123;title&#125;, &#123;price&#125;, &#123;discount&#125; lub &#123;url&#125;, aby boty automatycznie wypełniały je danymi okazji.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="tpl-name" className="text-xs font-medium">Nazwa wzorca</Label>
                <Input
                  id="tpl-name"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="np. Hit Dnia z Linkiem w Komentarzu"
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="tpl-content" className="text-xs font-medium">Treść wzorca</Label>
                  <span className="text-[11px] text-muted-foreground">Kliknij zmienną, by dodać:</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {['{title}', '{price}', '{oldPrice}', '{discount}', '{merchant}', '{temperature}', '{url}'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 text-xs bg-secondary hover:bg-secondary/80 rounded border font-mono text-primary"
                    >
                      +{v}
                    </button>
                  ))}
                </div>

                <Textarea
                  id="tpl-content"
                  rows={7}
                  value={templateContent}
                  onChange={e => setTemplateContent(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <Label htmlFor="tpl-hashtags" className="text-xs font-medium">Hashtagi</Label>
                <Input
                  id="tpl-hashtags"
                  value={templateHashtags}
                  onChange={e => setTemplateHashtags(e.target.value)}
                  placeholder="#okazje #promocje #okazjeplus"
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateModal(false)} disabled={savingTemplate}>
                Anuluj
              </Button>
              <Button onClick={handleSaveAsTemplate} disabled={savingTemplate}>
                {savingTemplate ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Zapisz wzorzec
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
