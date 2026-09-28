/**
 * Templates Tab Component for Social Media Admin
 * Manages post templates for different platforms
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SocialTemplate, SocialPlatform } from '@/lib/types';
import { saveSocialTemplate, deleteSocialTemplate, getPlatformDisplayName } from '@/lib/social-automation';
import { seedCuratedTemplatesAction } from '@/app/actions/publish-social-post';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Save, X, Sparkles, Copy, Check } from 'lucide-react';

interface TemplatesTabProps {
  templates: SocialTemplate[];
  onUpdate: () => Promise<void>;
}

export function TemplatesTab({ templates, onUpdate }: TemplatesTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SocialTemplate>>({
    name: '',
    platform: 'facebook',
    type: 'deal',
    contentTemplate: '',
    hashtagsTemplate: '',
    imageStyle: 'clean',
  });

  function startCreate() {
    setFormData({
      name: '',
      platform: 'facebook',
      type: 'deal',
      contentTemplate: '',
      hashtagsTemplate: '',
      imageStyle: 'clean',
    });
    setIsCreating(true);
    setEditingId(null);
  }

  function startEdit(template: SocialTemplate) {
    setFormData(template);
    setEditingId(template.id!);
    setIsCreating(false);
  }

  function cancelEdit() {
    setIsCreating(false);
    setEditingId(null);
    setFormData({});
  }

  async function handleSeedCurated() {
    try {
      setSeeding(true);
      const res = await seedCuratedTemplatesAction();
      if (!res.success) {
        toast.error(res.error || 'Nie udało się wgrać polecanych wzorców');
        return;
      }
      toast.success(`Wgrano ${res.count} polecane wzorce Okazje Plus!`);
      await onUpdate();
    } catch (err) {
      console.error('Error seeding templates:', err);
      toast.error('Błąd podczas wgrywania wzorców');
    } finally {
      setSeeding(false);
    }
  }

  function handleCopyContent(template: SocialTemplate) {
    if (template.contentTemplate) {
      navigator.clipboard.writeText(template.contentTemplate);
      setCopiedId(template.id || 'copied');
      toast.success('Treść wzorca skopiowana do schowka');
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleSave() {
    try {
      if (!formData.name || !formData.contentTemplate) {
        toast.error('Wypełnij wymagane pola');
        return;
      }

      await saveSocialTemplate(formData as SocialTemplate);
      toast.success('Szablon zapisany');
      await onUpdate();
      cancelEdit();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Błąd zapisywania szablonu');
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('Na pewno usunąć szablon?')) return;

    try {
      await deleteSocialTemplate(templateId);
      toast.success('Szablon usunięty');
      await onUpdate();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Błąd usuwania szablonu');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Dobre Wzorce i Szablony Postów</CardTitle>
              <CardDescription>
                Zarządzaj sprawdzonymi szablonami treści. Zapisuj dobre wzory z kolejki lub twórz nowe.
              </CardDescription>
            </div>
            {!isCreating && !editingId && (
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleSeedCurated} 
                  variant="outline" 
                  size="sm" 
                  disabled={seeding}
                  className="text-xs border-amber-300 dark:border-amber-800"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                  {seeding ? 'Wgrywanie...' : 'Wgraj polecane wzorce'}
                </Button>
                <Button onClick={startCreate} size="sm" className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Nowy wzorzec
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isCreating || editingId) && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">
                  {isCreating ? 'Nowy szablon' : 'Edytuj szablon'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-name">Nazwa szablonu *</Label>
                    <Input
                      id="template-name"
                      placeholder="np. Hot Deal Facebook"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-platform">Platforma *</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value: SocialPlatform) => setFormData({ ...formData, platform: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="twitter">Twitter/X</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-type">Typ *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: 'deal' | 'product' | 'article') => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deal">Okazja</SelectItem>
                        <SelectItem value="product">Produkt</SelectItem>
                        <SelectItem value="article">Artykuł</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="template-image-style">Styl obrazu</Label>
                    <Select
                      value={formData.imageStyle}
                      onValueChange={(value) => setFormData({ ...formData, imageStyle: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clean">Clean (czysty)</SelectItem>
                        <SelectItem value="minimal">Minimal (minimalistyczny)</SelectItem>
                        <SelectItem value="bold">Bold (odważny)</SelectItem>
                        <SelectItem value="gradient">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="template-content">Szablon treści *</Label>
                    <span className="text-[11px] text-muted-foreground">Kliknij, by wstawić zmienną:</span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {['{title}', '{price}', '{oldPrice}', '{discount}', '{merchant}', '{temperature}', '{url}'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          contentTemplate: (prev.contentTemplate || '') + v
                        }))}
                        className="px-2 py-0.5 text-xs bg-muted hover:bg-muted/80 rounded border font-mono text-primary transition-colors"
                      >
                        +{v}
                      </button>
                    ))}
                  </div>

                  <Textarea
                    id="template-content"
                    placeholder="np. 🔥 GORĄCA OKAZJA: {title}!\n💰 Cena: {price} {oldPrice} {discount}\n👉 Sprawdź szczegóły w 1. komentarzu:\n{url}"
                    rows={6}
                    value={formData.contentTemplate || ''}
                    onChange={(e) => setFormData({ ...formData, contentTemplate: e.target.value })}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dostępne zmienne: {'{title}, {description}, {price}, {oldPrice}, {discount}, {merchant}, {temperature}, {url}'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="template-hashtags">Hashtagi (opcjonalne)</Label>
                  <Input
                    id="template-hashtags"
                    placeholder="np. #okazje #promocje #zakupy"
                    value={formData.hashtagsTemplate || ''}
                    onChange={(e) => setFormData({ ...formData, hashtagsTemplate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Możesz też użyć AI do automatycznego generowania hashtagów
                  </p>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Zapisz
                  </Button>
                  <Button onClick={cancelEdit} variant="outline" aria-label="Anuluj edycję">
                    <X className="h-4 w-4 mr-2" />
                    Anuluj
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {templates.length === 0 && !isCreating && !editingId ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20 space-y-3">
              <Sparkles className="h-10 w-10 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Brak zapisanych wzorców</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Możesz utworzyć własny szablon, zapisać dowolny post z kolejki jako wzorzec, albo jednym kliknięciem załadować polecane wzorce Okazje Plus.
                </p>
              </div>
              <Button onClick={handleSeedCurated} variant="default" size="sm" disabled={seeding}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                {seeding ? 'Wgrywanie...' : 'Wgraj polecane wzorce Okazje Plus'}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary">
                            {getPlatformDisplayName(template.platform)}
                          </Badge>
                          <Badge variant="outline">
                            {template.type === 'deal' ? 'Okazja' : template.type === 'product' ? 'Produkt' : 'Artykuł'}
                          </Badge>
                          <Badge variant="outline">
                            {template.imageStyle}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          onClick={() => handleCopyContent(template)}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          title="Kopiuj treść szablonu do schowka"
                        >
                          {copiedId === template.id ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          onClick={() => startEdit(template)}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          title="Edytuj szablon"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(template.id!)}
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs"
                          title="Usuń szablon"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Szablon treści:</Label>
                        <div className="mt-1 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap leading-relaxed">
                          {template.contentTemplate}
                        </div>
                      </div>
                      {template.hashtagsTemplate && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Hashtagi:</Label>
                          <div className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                            {template.hashtagsTemplate}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
